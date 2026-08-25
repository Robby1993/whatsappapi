import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  WAVersion,
} from '@whiskeysockets/baileys';
import { Session } from '../database/models/Session';
import { MessageLog } from '../database/models/MessageLog';
import { PostgresAuthService } from './postgres-auth.service';
import { IncomingMessageHandler } from './incoming-message-handler.service';
import { WhatsappUtils } from './whatsapp-utils';

import { join } from 'path';
import * as fs from 'fs';
import { proto } from '@whiskeysockets/baileys';

@Injectable()
export class WhatsappService implements OnModuleInit {
  public sessions = new Map<string, any>();
  public sessionStatus = new Map<string, any>();
  private initializing = new Map<string, Promise<any>>();
  private loggingOut = new Set<string>();

  constructor(
    @InjectModel(Session)
    private sessionModel: typeof Session,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
    private postgresAuthService: PostgresAuthService,
    private incomingMessageHandler: IncomingMessageHandler,
  ) {}

  async onModuleInit() {
    // Restore active sessions on startup
    const activeSessions = await this.sessionModel.findAll({
      where: { dataType: 'creds', dataId: 'base' },
    });

    for (const session of activeSessions) {
      console.log(`🔄 Restoring session: ${session.phone}`);
      this.initWhatsApp(session.phone).catch(() => {});
    }
  }

  async initWhatsApp(phone: string): Promise<any> {
    const cleanPhone = phone.replace(/\D/g, '');

    // Guard against multiple initializations
    if (this.initializing.has(cleanPhone)) return this.initializing.get(cleanPhone);

    // If already connected, return the existing session
    if (this.sessions.has(cleanPhone)) {
        const currentStatus = this.getStatus(cleanPhone).status;
        if (currentStatus === 'connected' || currentStatus === 'connecting' || currentStatus === 'pairing') {
            return this.sessions.get(cleanPhone);
        }
    }

    const promise = (async () => {
      try {
        // Force cleanup of old session if it exists
        const oldSock = this.sessions.get(cleanPhone);
        if (oldSock) {
          try {
            oldSock.ev.removeAllListeners();
            if (oldSock.ws) oldSock.ws.close();
          } catch (e) {}
          this.sessions.delete(cleanPhone);
        }

        console.log(`🔌 Initializing WhatsApp session: ${cleanPhone}`);
        const { state, saveCreds } = await this.postgresAuthService.getAuthState(cleanPhone);
        console.log(`🔑 Auth State loaded for: ${cleanPhone}`);

        // Get version with a faster fallback and retry
        const { version } = (await fetchLatestBaileysVersion().catch(() => ({
          version: [2, 3000, 1015901307],
        }))) as { version: WAVersion };

        console.log(`📦 WhatsApp Version: ${version.join('.')} for ${cleanPhone}`);

        const sock = makeWASocket({
          version,
          auth: state,
          printQRInTerminal: false,
          browser: Browsers.ubuntu('Chrome'),
          syncFullHistory: false,
          shouldSyncHistoryMessage: () => false,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 0,
          keepAliveIntervalMs: 30000,
          generateHighQualityLinkPreview: true,
          retryRequestDelayMs: 5000,
          markOnlineOnConnect: true,
          // Enhanced retry logic for LID/PN decryption issues
          maxMsgRetryCount: 5,
          getMessage: async (key) => {
            try {
              if (this.messageLogModel) {
                const msg = await this.messageLogModel.findOne({
                  where: { messageId: key.id }
                });
                if (msg) return { conversation: msg.message };
              }
              return { conversation: 'Message will be delivered shortly...' };
            } catch (e) {
              return { conversation: 'Processing message...' };
            }
          },
          patchMessageBeforeSending: (message) => {
             const requiresPatch = !!(
               message.buttonsMessage ||
               message.templateMessage ||
               message.listMessage
             );
             if (requiresPatch) {
               return {
                 viewOnceMessage: {
                   message: {
                     messageContextInfo: {
                       deviceListMetadata: {},
                       deviceListMetadataVersion: 2,
                     },
                     ...message,
                   },
                 },
               };
             }
             return message;
          },
        });

        this.sessions.set(cleanPhone, sock);
        this.sessionStatus.set(cleanPhone, { status: 'connecting' });

        sock.ev.on('creds.update', async (update) => {
          Object.assign(state.creds, update);
          await saveCreds();
        });

        sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
          const status = this.sessionStatus.get(cleanPhone) || { status: 'connecting' };

          if (qr) {
            status.qr = qr;
            status.status = 'pairing';
            this.sessionStatus.set(cleanPhone, status);
            console.log(`📸 New QR Code generated for: ${cleanPhone}`);
          }

          if (connection === 'open') {
            this.sessionStatus.set(cleanPhone, { status: 'connected', qr: null, pairingCode: null });
            console.log(`✅ WhatsApp Connected: ${cleanPhone}`);
          }

          if (connection === 'close') {
            const reason = (lastDisconnect?.error as any)?.output?.statusCode;
            console.log(`❌ Connection closed for ${cleanPhone}. Reason: ${reason}`);

            // Important: Clear the session from the map so a new one can be started
            this.sessions.delete(cleanPhone);

            if (reason === DisconnectReason.loggedOut) {
              this.sessionStatus.delete(cleanPhone);
              this.sessionModel.destroy({ where: { phone: cleanPhone } }).catch(() => {});
            } else if (reason === 515 || reason === DisconnectReason.restartRequired) {
              console.log(`🔄 Restart required (${reason}) for ${cleanPhone}, reconnecting now...`);
              // Use a small delay to avoid tight loops
              setTimeout(() => this.initWhatsApp(cleanPhone).catch(() => {}), 1000);
            } else if (!this.loggingOut.has(cleanPhone)) {
              this.sessionStatus.set(cleanPhone, { ...status, status: 'disconnected' });
              // Backoff strategy
              const delay = reason === 401 ? 10000 : 5000;
              setTimeout(() => this.initWhatsApp(cleanPhone), delay);
            }
          }
        });

        sock.ev.on('messages.upsert', (m) => this.incomingMessageHandler.handle(cleanPhone, sock, m));

        return sock;
      } catch (err) {
        console.error(`💥 Failed to init WhatsApp for ${cleanPhone}:`, err.message);
        this.sessionStatus.delete(cleanPhone);
        throw err;
      } finally {
        this.initializing.delete(cleanPhone);
      }
    })();

    this.initializing.set(cleanPhone, promise);
    return promise;
  }

  async forceLogout(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    this.loggingOut.add(cleanPhone);
    const sock = this.sessions.get(cleanPhone);
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        if (sock.ws?.readyState === 1) await sock.logout().catch(() => {});
        if (sock.ws) sock.ws.close();
      } catch (e) {}
      this.sessions.delete(cleanPhone);
      this.sessionStatus.delete(cleanPhone);
    }
    await this.sessionModel.destroy({ where: { phone: cleanPhone } });
    setTimeout(() => this.loggingOut.delete(cleanPhone), 2000);
  }

  getStatus(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    return this.sessionStatus.get(cleanPhone) || { status: 'not_connected' };
  }

  async broadcast(sender: string, numbers: string[], message: string, messageLogModel: any, statModel: any, mediaUrl?: string, mediaType?: string) {
    const sock = this.sessions.get(sender);
    if (!sock || this.getStatus(sender).status !== 'connected') {
      throw new Error(`WhatsApp (${sender}) is disconnected.`);
    }

    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.replace(/\D/g, '') + '@s.whatsapp.net';

        const messageOptions = await WhatsappUtils.prepareMessageOptions(message, mediaUrl, mediaType);

        if (!messageOptions) {
          results.push({ number: num, status: 'failed', error: 'Empty message' });
          continue;
        }

        const result = await sock.sendMessage(jid, messageOptions);

        await messageLogModel.create({
          sender,
          receiver: num,
          message,
          status: 'sent',
          mediaUrl,
          mediaType,
          messageId: result?.key?.id
        });
        const [stat] = await statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');

        results.push({ number: num, status: 'sent' });
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000)); // Throttling
      } catch (e) {
        results.push({ number: num, status: 'failed', error: e.message });
      }
    }
    return results;
  }
}
