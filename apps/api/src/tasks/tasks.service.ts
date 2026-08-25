import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WhatsappUtils } from '../whatsapp/whatsapp-utils';
import { QueuedMessage } from '../database/models/QueuedMessage';
import { ScheduledMessage } from '../database/models/ScheduledMessage';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';
import { Campaign } from '../database/models/Campaign';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private whatsappService: WhatsappService,
    @InjectModel(QueuedMessage)
    private queuedMessageModel: typeof QueuedMessage,
    @InjectModel(ScheduledMessage)
    private scheduledMessageModel: typeof ScheduledMessage,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
    @InjectModel(Stat)
    private statModel: typeof Stat,
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
  ) {}

  @Interval(5000) // Every 5 seconds
  async processQueue() {
    try {
      // 1. Reset stuck messages (processing for more than 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await this.queuedMessageModel.update(
        { status: 'pending' },
        {
          where: {
            status: 'processing',
            updatedAt: { [Op.lte]: fiveMinutesAgo }
          }
        }
      );

      // 2. Fetch a batch of pending messages that are ready to be sent
      const messages = await this.queuedMessageModel.findAll({
        where: {
          status: 'pending',
          [Op.or]: [
            { scheduledAt: null },
            { scheduledAt: { [Op.lte]: new Date() } }
          ]
        },
        limit: 10, // Process 10 messages per tick
        order: [['createdAt', 'ASC']]
      });

      if (messages.length === 0) return;

      this.logger.log(`🚀 Processing queue batch of ${messages.length} messages`);

      for (const msg of messages) {
        await msg.update({ status: 'processing' });

        const sock = this.whatsappService.sessions.get(msg.sender);
        const status = this.whatsappService.getStatus(msg.sender).status;

        if (!sock || status !== 'connected') {
          if (status === 'not_connected' || status === 'disconnected') {
            this.logger.log(`⏳ Queue: Sender ${msg.sender} not connected, attempting to start...`);
            this.whatsappService.initWhatsApp(msg.sender).catch(() => {});
          }
          await msg.update({ status: 'pending' });
          continue; // Skip this one for now
        }

        try {
          // Update campaign status to processing if it's still pending
          if (msg.campaignId) {
            await this.campaignModel.update(
              { status: 'processing' },
              { where: { id: msg.campaignId, status: 'pending' } }
            );
          }

          const cleanNumber = msg.receiver.replace(/\D/g, '');
          if (!cleanNumber || cleanNumber.length < 10) {
            throw new Error(`Invalid phone number: ${msg.receiver}`);
          }

          const jid = cleanNumber + '@s.whatsapp.net';

          const messageOptions = await WhatsappUtils.prepareMessageOptions(msg.message, msg.mediaUrl, msg.mediaType);

          if (!messageOptions) {
            await msg.update({ status: 'failed' });
            throw new Error('Message content or media is missing');
          }

          // Add a small delay between messages in a batch to avoid being banned
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

          // Set a 30 second timeout for sending the message
          const sentMsg = await Promise.race([
            sock.sendMessage(jid, messageOptions),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Send message timeout')), 30000)
            )
          ]) as any;

          await msg.update({ status: 'sent' });

          if (msg.campaignId) {
            const campaign = await this.campaignModel.findByPk(msg.campaignId);
            if (campaign) {
              await campaign.increment('sentCount');
              if (campaign.sentCount + campaign.failedCount >= campaign.totalContacts) {
                await campaign.update({ status: 'completed' });
              }
            }
          }

          await this.messageLogModel.create({
            sender: msg.sender,
            receiver: msg.receiver,
            message: msg.message,
            status: 'sent',
            campaignId: msg.campaignId,
            messageId: sentMsg?.key?.id,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType,
          });

          const [stat] = await this.statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
          await stat.increment('totalMessagesSent');
        } catch (e) {
          this.logger.error(`❌ Error sending queued message to ${msg.receiver}:`, e.message);
          await msg.update({ status: 'failed' });
          if (msg.campaignId) {
            const campaign = await this.campaignModel.findByPk(msg.campaignId);
            if (campaign) {
              await campaign.increment('failedCount');
              if (campaign.sentCount + campaign.failedCount >= campaign.totalContacts) {
                await campaign.update({ status: 'completed' });
              }
            }
          }
        }
      }
    } catch (e) {
      this.logger.error('Queue worker error:', e.message);
    }
  }

  @Interval(30000) // Every 30 seconds
  async processScheduledMessages() {
    try {
      const now = Date.now();
      const pending = await this.scheduledMessageModel.findAll({
        where: {
          status: 'pending',
          scheduleTime: { [Op.lte]: now },
        },
      });

      for (const msg of pending) {
        const sock = this.whatsappService.sessions.get(msg.sender);
        if (!sock || this.whatsappService.getStatus(msg.sender).status !== 'connected') {
          this.logger.log(`⏰ Scheduler: Sender ${msg.sender} not connected, attempting to start...`);
          this.whatsappService.initWhatsApp(msg.sender).catch(() => {});
          continue;
        }

        try {
          const jid = msg.receiver.replace(/\D/g, '') + '@s.whatsapp.net';

          const messageOptions = await WhatsappUtils.prepareMessageOptions(msg.message, msg.mediaUrl, msg.mediaType);

          if (!messageOptions) {
            await msg.update({ status: 'failed' });
            continue;
          }

          const sentMsg = await sock.sendMessage(jid, messageOptions) as any;

          await msg.update({ status: 'sent' });

          await this.messageLogModel.create({
            sender: msg.sender,
            receiver: msg.receiver,
            message: msg.message,
            status: 'sent',
            messageId: sentMsg?.key?.id,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType,
          });

          const [stat] = await this.statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
          await stat.increment('totalMessagesSent');
        } catch (e) {
          this.logger.error(`❌ Scheduler error for ${msg.receiver}:`, e.message);
          if (now - Number(msg.scheduleTime) > 3600000) {
            await msg.update({ status: 'failed' });
          }
        }
      }
    } catch (e) {
      this.logger.error('Scheduler worker error:', e.message);
    }
  }
}
