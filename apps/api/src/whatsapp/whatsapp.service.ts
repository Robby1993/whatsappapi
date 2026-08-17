import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  WAVersion,
} from '@whiskeysockets/baileys';
import { Session } from '../database/models/Session';
import { PostgresAuthService } from './postgres-auth.service';
import { IncomingMessageHandler } from './incoming-message-handler.service';

@Injectable()
export class WhatsappService implements OnModuleInit {
  public sessions = new Map<string, any>();
  public sessionStatus = new Map<string, any>();
  private initializing = new Map<string, Promise<any>>();
  private loggingOut = new Set<string>();

  constructor(
    @InjectModel(Session)
    private sessionModel: typeof Session,
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
    if (this.initializing.has(cleanPhone)) return this.initializing.get(cleanPhone);

    const promise = (async () => {
      try {
        if (this.sessions.has(cleanPhone)) {
          const oldSock = this.sessions.get(cleanPhone);
          oldSock.ev.removeAllListeners();
          if (oldSock.ws) oldSock.ws.close();
          this.sessions.delete(cleanPhone);
        }

        console.log(`🔌 Initializing WhatsApp session: ${cleanPhone}`);
        const { state, saveCreds } = await this.postgresAuthService.getAuthState(cleanPhone);
        const { version } = (await fetchLatestBaileysVersion().catch(() => ({
          version: [2, 3000, 1015901307],
        }))) as { version: WAVersion };

        const sock = makeWASocket({
          version,
          auth: state,
          printQRInTerminal: false,
          browser: Browsers.ubuntu('Chrome'),
          syncFullHistory: false,
          connectTimeoutMs: 60000,
        });

        this.sessions.set(cleanPhone, sock);
        this.sessionStatus.set(cleanPhone, { status: 'connecting' });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
          const status = this.sessionStatus.get(cleanPhone) || { status: 'connecting' };
          if (qr) status.qr = qr;

          if (connection === 'open') {
            this.sessionStatus.set(cleanPhone, { status: 'connected', qr: null });
            console.log(`✅ WhatsApp Connected: ${cleanPhone}`);
          }

          if (connection === 'close') {
            const reason = (lastDisconnect?.error as any)?.output?.statusCode;
            console.log(`❌ Connection closed for ${cleanPhone}. Reason: ${reason}`);

            if (reason === DisconnectReason.loggedOut) {
              this.sessions.delete(cleanPhone);
              this.sessionStatus.delete(cleanPhone);
              this.sessionModel.destroy({ where: { phone: cleanPhone } }).catch(() => {});
            } else if (!this.loggingOut.has(cleanPhone)) {
              const currentStatus = this.sessionStatus.get(cleanPhone) || {};
              this.sessionStatus.set(cleanPhone, { ...currentStatus, status: 'disconnected' });
              setTimeout(() => this.initWhatsApp(cleanPhone), 5000);
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

  async broadcast(sender: string, numbers: string[], message: string, messageLogModel: any, statModel: any) {
    const sock = this.sessions.get(sender);
    if (!sock || this.getStatus(sender).status !== 'connected') {
      throw new Error(`WhatsApp (${sender}) is disconnected.`);
    }

    const results = [];
    for (const num of numbers) {
      try {
        const jid = num.replace(/\D/g, '') + '@s.whatsapp.net';
        await sock.sendMessage(jid, { text: message });

        await messageLogModel.create({ sender, receiver: num, message, status: 'sent' });
        const [stat] = await statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
        await stat.increment('totalMessagesSent');

        results.push({ number: num, status: 'sent' });
        await new Promise(r => setTimeout(r, 1000)); // Throttling
      } catch (e) {
        results.push({ number: num, status: 'failed', error: e.message });
      }
    }
    return results;
  }
}
