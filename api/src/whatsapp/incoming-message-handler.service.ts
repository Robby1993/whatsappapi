import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import axios from 'axios';
import { ChatFlow } from '../database/models/ChatFlow';
import { User } from '../database/models/User';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';

@Injectable()
export class IncomingMessageHandler {
  constructor(
    @InjectModel(ChatFlow)
    private chatFlowModel: typeof ChatFlow,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
    @InjectModel(Stat)
    private statModel: typeof Stat,
  ) {}

  async handle(phone: string, sock: any, m: any) {
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

        const sender = msg.key.remoteJid;

        let text =
          msgContent.conversation ||
          msgContent.extendedTextMessage?.text ||
          msgContent.imageMessage?.caption ||
          msgContent.videoMessage?.caption ||
          msgContent.buttonsResponseMessage?.selectedDisplayText ||
          msgContent.listResponseMessage?.singleSelectReply?.title ||
          msgContent.templateButtonReplyMessage?.selectedDisplayText ||
          '';

        text = text.toLowerCase().trim();
        if (!text) continue;

        console.log(`📩 ${phone} ← ${sender}: "${text}"`);

        const flow = await this.chatFlowModel.findOne({
          where: {
            userNumber: phone,
            isActive: true,
            triggerKeyword: {
              [Op.iLike]: `%${text}%`,
            },
          },
        });

        if (flow) {
          console.log(`🎯 Flow Triggered: ${flow.triggerKeyword}`);
          let response: any = {};

          switch (flow.responseType) {
            case 'text':
              response = { text: flow.responseText };
              break;
            case 'image':
            case 'video':
            case 'audio':
            case 'document':
              response = {
                [flow.responseType]: { url: flow.mediaUrl },
                caption: flow.responseType !== 'audio' ? flow.responseText : undefined,
              };
              break;
            case 'buttons':
              response = {
                text: flow.responseText,
                footer: flow.footer || '',
                buttons: (flow.buttons as unknown as string[] || []).slice(0, 3).map((b, i) => ({
                  buttonId: `btn_${i}`,
                  buttonText: { displayText: b },
                  type: 1,
                })),
                headerType: 1,
              };
              break;
            case 'list':
              response = {
                text: flow.responseText,
                footer: flow.footer || '',
                title: flow.header || 'Menu',
                buttonText: 'Select Option',
                sections: [
                  {
                    title: 'Options',
                    rows: (flow.sections as any[] || []).map((item, i) => ({
                      title: item.title,
                      description: item.description || '',
                      rowId: `row_${i}`,
                    })),
                  },
                ],
              };
              break;
          }

          await sock.sendMessage(sender, response);
        }

        // Webhook and Logging
        const user = await this.userModel.findOne({ where: { number: phone } });
        const admin = await this.userModel.findOne({ where: { userType: 'admin' } });

        const payload = {
          phone,
          sender,
          message: text,
          type: Object.keys(msgContent)[0],
          timestamp: msg.messageTimestamp,
        };

        if (user?.webhookUrl) axios.post(user.webhookUrl, payload).catch(() => {});
        if (admin?.webhookUrl && admin.number !== phone) {
          axios.post(admin.webhookUrl, { ...payload, userNumber: phone }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('❌ Incoming Message Error:', err.message);
    }
  }
}
