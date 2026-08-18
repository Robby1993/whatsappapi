import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { QueuedMessage } from '../database/models/QueuedMessage';
import { ScheduledMessage } from '../database/models/ScheduledMessage';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';
import { Campaign } from '../database/models/Campaign';

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

  @Interval(10000) // Every 10 seconds
  async processQueue() {
    try {
      const msg = await this.queuedMessageModel.findOne({ where: { status: 'pending' } });
      if (!msg) return;

      await msg.update({ status: 'processing' });

      const sock = this.whatsappService.sessions.get(msg.sender);
      const status = this.whatsappService.getStatus(msg.sender).status;

      if (!sock || status !== 'connected') {
        // Only attempt to start if not already trying
        if (status === 'not_connected' || status === 'disconnected') {
          this.logger.log(`⏳ Queue: Sender ${msg.sender} not connected, attempting to start...`);
          this.whatsappService.initWhatsApp(msg.sender).catch(() => {});
        }

        await msg.update({ status: 'pending' });
        return;
      }

      try {
        const jid = msg.receiver.replace(/\D/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: msg.message });

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
        });

        const [stat] = await this.statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');
      } catch (e) {
        this.logger.error(`❌ Error sending queued message to ${msg.receiver}:`, e.message);
        await msg.update({ status: 'failed' });
        if (msg.campaignId) {
          const campaign = await this.campaignModel.findByPk(msg.campaignId);
          if (campaign) await campaign.increment('failedCount');
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
          await sock.sendMessage(jid, { text: msg.message });

          await msg.update({ status: 'sent' });

          await this.messageLogModel.create({
            sender: msg.sender,
            receiver: msg.receiver,
            message: msg.message,
            status: 'sent',
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
