import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import axios from 'axios';
import { ChatFlow } from '../database/models/ChatFlow';
import { ChatSession } from '../database/models/ChatSession';
import { User } from '../database/models/User';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';
import { WhatsappService } from './whatsapp.service';

@Injectable()
export class IncomingMessageHandler {
  constructor(
    @InjectModel(ChatFlow)
    private chatFlowModel: typeof ChatFlow,
    @InjectModel(ChatSession)
    private chatSessionModel: typeof ChatSession,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
    @InjectModel(Stat)
    private statModel: typeof Stat,
  ) {}

  async handle(botPhone: string, sock: any, m: any) {
    try {
      if (!m.messages || m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;

        let msgContent = msg.message;
        if (!msgContent) continue;

        // Unwrap nested messages
        if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
        if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;
        if (msgContent.viewOnceMessageV2) msgContent = msgContent.viewOnceMessageV2.message;
        if (msgContent.documentWithCaptionMessage) msgContent = msgContent.documentWithCaptionMessage.message;

        const senderJid = msg.key.remoteJid;

        let text =
          msgContent.conversation ||
          msgContent.extendedTextMessage?.text ||
          msgContent.imageMessage?.caption ||
          msgContent.videoMessage?.caption ||
          msgContent.buttonsResponseMessage?.selectedDisplayText ||
          msgContent.listResponseMessage?.singleSelectReply?.title ||
          msgContent.templateButtonReplyMessage?.selectedDisplayText ||
          '';

        text = text.trim();
        if (!text) continue;

        console.log(`📩 ${botPhone} ← ${senderJid}: "${text}"`);

        // 0. Handle Global Commands
        if (text.toLowerCase() === 'exit' || text.toLowerCase() === 'stop' || text.toLowerCase() === 'restart') {
           await this.chatSessionModel.destroy({ where: { senderJid, botPhone } });
           if (text.toLowerCase() === 'restart') {
              // Just fall through to step 1
           } else {
              await sock.sendMessage(senderJid, { text: 'Conversation ended. Send any keyword to start again.' });
              continue;
           }
        }

        // 1. Check for existing active session
        let session = await this.chatSessionModel.findOne({
          where: {
            senderJid,
            botPhone,
            currentFlowId: { [Op.ne]: null }
          }
        });

        if (session) {
          await this.processSession(sock, session, text);
        } else {
          // 2. Try to match a new flow
          const flows = await this.chatFlowModel.findAll({
            where: {
              isActive: true,
              [Op.or]: [
                { botPhone: botPhone },
                { botPhone: null }
              ]
            }
          });

          const matchedFlow = flows.find(f =>
            f.triggerKeywords.some(k => text.toLowerCase().includes(k.toLowerCase()))
          );

          if (matchedFlow) {
            console.log(`🎯 New Flow Triggered: ${matchedFlow.name}`);
            session = await this.chatSessionModel.create({
              senderJid,
              botPhone,
              currentFlowId: matchedFlow.id,
              currentStepIndex: 0,
              context: {},
              lastInteraction: new Date()
            });
            await this.executeFlowSteps(sock, matchedFlow, session);
          }
        }

        // Webhook and Logging (omitted for brevity in logic but kept in original)
        this.handleWebhooks(botPhone, senderJid, text, msgContent, msg.messageTimestamp);
      }
    } catch (err) {
      console.error('❌ Incoming Message Error:', err.message);
    }
  }

  private async processSession(sock: any, session: ChatSession, userInput: string) {
    const flow = await this.chatFlowModel.findByPk(session.currentFlowId);
    if (!flow || !flow.isActive) {
      await session.destroy();
      return;
    }

    const currentStep = flow.steps[session.currentStepIndex];

    // If we were waiting for input
    if (currentStep?.wait) {
      const context = session.context || {};
      if (currentStep.key) {
        context[currentStep.key] = userInput;
      }

      session.context = context;
      session.currentStepIndex += 1;
      session.lastInteraction = new Date();
      await session.save();

      // Continue to next steps
      await this.executeFlowSteps(sock, flow, session);
    } else {
        // This shouldn't happen if executeFlowSteps works correctly, but safe-guard
        session.currentStepIndex += 1;
        await session.save();
        await this.executeFlowSteps(sock, flow, session);
    }
  }

  private async executeFlowSteps(sock: any, flow: ChatFlow, session: ChatSession) {
    const senderJid = session.senderJid;

    while (session.currentStepIndex < flow.steps.length) {
      const step = flow.steps[session.currentStepIndex];

      // Send the response
      await this.sendStepResponse(sock, senderJid, step);

      if (step.wait) {
        // Stop here and wait for next user message
        console.log(`⏳ Flow ${flow.name}: Waiting at step ${session.currentStepIndex}`);
        break;
      }

      session.currentStepIndex += 1;
      session.lastInteraction = new Date();
      await session.save();
    }

    if (session.currentStepIndex >= flow.steps.length) {
      console.log(`✅ Flow ${flow.name}: Completed for ${senderJid}`);
      await session.destroy();
    }
  }

  private async sendStepResponse(sock: any, jid: string, step: any) {
    let response: any = {};
    const text = step.message || step.responseText || '';

    switch (step.type) {
      case 'text':
        response = { text };
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        response = {
          [step.type]: { url: step.mediaUrl },
          caption: step.type !== 'audio' ? text : undefined,
        };
        break;
      case 'buttons':
        response = {
          text,
          footer: step.footer || '',
          buttons: (step.buttons || []).slice(0, 3).map((b: string, i: number) => ({
            buttonId: `btn_${i}`,
            buttonText: { displayText: b },
            type: 1,
          })),
        };
        break;
    }

    if (Object.keys(response).length > 0) {
      await sock.sendMessage(jid, response);
    }
  }

  private async handleWebhooks(phone: string, sender: string, text: string, msgContent: any, timestamp: any) {
    try {
      const user = await this.userModel.findOne({ where: { number: phone } });
      const admin = await this.userModel.findOne({ where: { userType: 'admin' } });

      const payload = {
        phone,
        sender,
        message: text,
        type: Object.keys(msgContent)[0],
        timestamp,
      };

      if (user?.webhookUrl) axios.post(user.webhookUrl, payload).catch(() => {});
      if (admin?.webhookUrl && admin.number !== phone) {
        axios.post(admin.webhookUrl, { ...payload, userNumber: phone }).catch(() => {});
      }
    } catch (e) {}
  }
}
