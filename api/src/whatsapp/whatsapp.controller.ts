import { Controller, Post, Get, Body, Query, UseGuards, Req, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InjectModel } from '@nestjs/sequelize';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';

@Controller('whatsapp')
@UseGuards(TokenAuthGuard)
export class WhatsappController {
  constructor(
    private whatsappService: WhatsappService,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
    @InjectModel(Stat)
    private statModel: typeof Stat,
  ) {}

  @Post('connect-pair')
  async connectPair(@Body('phone') phone: string, @Req() req: any) {
    const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
    await this.whatsappService.forceLogout(targetPhone);
    const sock = await this.whatsappService.initWhatsApp(targetPhone);

    // Wait a bit for pairing code generation
    await new Promise((r) => setTimeout(r, 5000));

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(targetPhone);
      return { message: 'Pairing code generated', result: { pairingCode: code } };
    } else {
      return { message: 'Already connected', result: { status: 'connected' } };
    }
  }

  @Post('connect-qr')
  async connectQr(@Body('phone') phone: string, @Req() req: any) {
    const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
    await this.whatsappService.forceLogout(targetPhone);
    await this.whatsappService.initWhatsApp(targetPhone);

    // Poll for QR
    for (let i = 0; i < 30; i++) {
      const status = this.whatsappService.getStatus(targetPhone);
      if (status.qr) {
        return { message: 'QR generated', result: { qr: status.qr } };
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return { message: 'QR Timeout', result: null };
  }

  @Get('session-status')
  async getSessionStatus(@Query('phone') phone: string, @Req() req: any) {
    const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
    const status = this.whatsappService.getStatus(targetPhone);
    return { message: 'Status fetched', result: { ...status, phone: targetPhone } };
  }

  @Get('sessions')
  @UseGuards(AdminGuard)
  async getAllSessions() {
    const allStatus = Object.fromEntries(this.whatsappService.sessionStatus);
    return { message: 'Active sessions list', result: allStatus };
  }

  @Post('send-message')
  async sendMessage(@Body() body: { phone: string; message: string; from?: string }, @Req() req: any) {
    const sender = (body.from || req.userNumber).toString().replace(/\D/g, '');
    const sock = this.whatsappService.sessions.get(sender);

    if (!sock || this.whatsappService.getStatus(sender).status !== 'connected') {
      return { message: `WhatsApp (${sender}) is disconnected.`, result: null };
    }

    const jid = body.phone.replace(/\D/g, '') + '@s.whatsapp.net';
    const result = await sock.sendMessage(jid, { text: body.message });

    await this.messageLogModel.create({ sender, receiver: body.phone, message: body.message, status: 'sent' });
    const [stat] = await this.statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
    await stat.increment('totalMessagesSent');

    return { message: 'Message sent successfully', result };
  }

  @Post('logout')
  async logout(@Body('phone') phone: string, @Req() req: any) {
    const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
    await this.whatsappService.forceLogout(targetPhone);
    return { message: 'Logged out successfully' };
  }
}
