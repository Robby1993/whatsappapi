import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import axios from 'axios';
import { ChatFlow } from '../database/models/ChatFlow';
import { ChatSession } from '../database/models/ChatSession';
import { User } from '../database/models/User';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';
import { WhatsappUtils } from './whatsapp-utils';

@Injectable()
export class IncomingMessageHandler {
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minutes

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

  /**
   * Main entry point for processing incoming messages.
   */
  async handle(botPhone: string, sock: any, m: any) {
    try {
      if (!m.messages || m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;

        let msgContent = msg.message;
        if (!msgContent) continue;

        // Unwrap nested messages (ephemeral, view-once, etc.)
        msgContent = this.unwrapMessage(msgContent);
        if (!msgContent) continue;

        const senderJid = msg.key.remoteJid;
        const text = this.extractText(msgContent);

        if (!text || text.toLowerCase().includes('waiting for this message')) continue;
        console.log(`📩 ${botPhone} ← ${senderJid}: "${text}"`);

        // 0. Handle Global Commands (Exit/Restart)
        if (this.isGlobalCommand(text)) {
           await this.chatSessionModel.destroy({ where: { senderJid, botPhone } });
           if (text.toLowerCase() === 'restart') {
              // Continue to start a new flow
           } else {
              await sock.sendMessage(senderJid, { text: 'Session ended. You can start again by sending a keyword.' });
              continue;
           }
        }

        // 1. Session Management (Check existing & Timeout)
        let session = await this.chatSessionModel.findOne({
          where: { senderJid, botPhone, currentFlowId: { [Op.ne]: null } }
        });

        if (session) {
          const isTimedOut = new Date().getTime() - new Date(session.lastInteraction).getTime() > this.SESSION_TIMEOUT_MS;
          if (isTimedOut) {
            console.log(`⏰ Session timed out for ${senderJid}`);
            await session.destroy();
            session = null;
          }
        }

        // 2. Process existing session or attempt to match new flow
        if (session) {
          await this.processSession(sock, session, text);
        } else {
          const matchedFlow = await this.findMatchingFlow(botPhone, text);
          if (matchedFlow) {
            console.log(`🎯 Flow Triggered: ${matchedFlow.name}`);
            session = await this.chatSessionModel.create({
              senderJid,
              botPhone,
              currentFlowId: matchedFlow.id,
              currentStepIndex: 0,
              context: {},
              lastInteraction: new Date()
            });
            await this.executeFlowSteps(sock, matchedFlow, session);
          } else {
            // 3. Fallback logic
            await this.handleFallback(botPhone, sock, senderJid, text);
          }
        }

        // Webhook and Logging
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

    if (currentStep?.wait) {
      const context = session.context || {};
      if (currentStep.key) {
        context[currentStep.key] = userInput;
      }

      session.context = context;
      session.currentStepIndex += 1;
      session.lastInteraction = new Date();
      await session.save();

      await this.executeFlowSteps(sock, flow, session);
    } else {
      session.currentStepIndex += 1;
      await session.save();
      await this.executeFlowSteps(sock, flow, session);
    }
  }

  private async executeFlowSteps(sock: any, flow: ChatFlow, session: ChatSession) {
    const senderJid = session.senderJid;

    while (session.currentStepIndex < flow.steps.length) {
      const step = flow.steps[session.currentStepIndex];

      await this.sendStepResponse(sock, senderJid, step, session.context);

      if (step.wait) {
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

  private async sendStepResponse(sock: any, jid: string, step: any, context: any) {
    const rawText = step.message || step.responseText || '';
    const formattedText = WhatsappUtils.replaceVariables(rawText, context);

    let options: any;

    switch (step.type) {
      case 'text':
        options = { text: formattedText };
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        options = await WhatsappUtils.prepareMessageOptions(formattedText, step.mediaUrl, step.type);
        break;
      case 'buttons':
        options = {
          text: formattedText,
          footer: step.footer || '',
          buttons: (step.buttons || []).slice(0, 3).map((b: string, i: number) => ({
            buttonId: `btn_${i}`,
            buttonText: { displayText: b },
            type: 1,
          })),
        };
        break;
    }

    if (options) {
      await sock.sendMessage(jid, options);
    }
  }

  private async findMatchingFlow(botPhone: string, text: string): Promise<ChatFlow | null> {
    const flows = await this.chatFlowModel.findAll({
      where: {
        isActive: true,
        [Op.or]: [{ botPhone: botPhone }, { botPhone: null }]
      }
    });

    return flows.find(f => WhatsappUtils.matchKeyword(text, f.triggerKeywords)) || null;
  }

  private async handleFallback(botPhone: string, sock: any, senderJid: string, text: string) {
    const fallbackFlow = await this.chatFlowModel.findOne({
      where: {
        isActive: true,
        [Op.or]: [{ botPhone: botPhone }, { botPhone: null }],
        name: { [Op.iLike]: '%fallback%' }
      }
    });

    if (fallbackFlow) {
      const session = await this.chatSessionModel.create({
        senderJid,
        botPhone,
        currentFlowId: fallbackFlow.id,
        currentStepIndex: 0,
        context: { originalInput: text },
        lastInteraction: new Date()
      });
      await this.executeFlowSteps(sock, fallbackFlow, session);
    }
  }

  private unwrapMessage(msg: any): any {
    if (msg.ephemeralMessage) return msg.ephemeralMessage.message;
    if (msg.viewOnceMessage) return msg.viewOnceMessage.message;
    if (msg.viewOnceMessageV2) return msg.viewOnceMessageV2.message;
    if (msg.documentWithCaptionMessage) return msg.documentWithCaptionMessage.message;
    return msg;
  }

  private extractText(msgContent: any): string {
    const text = msgContent.conversation ||
      msgContent.extendedTextMessage?.text ||
      msgContent.imageMessage?.caption ||
      msgContent.videoMessage?.caption ||
      msgContent.buttonsResponseMessage?.selectedDisplayText ||
      msgContent.listResponseMessage?.singleSelectReply?.title ||
      msgContent.templateButtonReplyMessage?.selectedDisplayText ||
      msgContent.templateButtonReplyMessage?.selectedId ||
      msgContent.interactiveResponseMessage?.body?.text ||
      '';
    return text.trim();
  }

  private isGlobalCommand(text: string): boolean {
    const cmd = text.toLowerCase().trim();
    return ['exit', 'stop', 'restart'].includes(cmd);
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
