import { Controller, Post, Get, Body, Query, UseGuards, Req, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappUtils } from './whatsapp-utils';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { InjectModel } from '@nestjs/sequelize';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async uploadFile(@UploadedFile() file: any) {
    const apiUrl = process.env.API_URL || 'http://localhost:5001';
    const url = `${apiUrl}/uploads/${file.filename}`;
    return {
      message: 'File uploaded successfully',
      result: {
        url,
        type: file.mimetype.split('/')[0] === 'application' ? 'document' : file.mimetype.split('/')[0]
      }
    };
  }

  @Post('connect-pair')
  async connectPair(@Body('phone') phone: string, @Req() req: any) {
    try {
      const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
      console.log(`📡 Requesting pairing code for: ${targetPhone}`);

      await this.whatsappService.forceLogout(targetPhone);
      const sock = await this.whatsappService.initWhatsApp(targetPhone);

      // Wait for socket to be ready
      await new Promise((r) => setTimeout(r, 6000));

      if (sock && !sock.authState.creds.registered) {
        const code = await sock.requestPairingCode(targetPhone);
        const currentStatus = this.whatsappService.sessionStatus.get(targetPhone) || {};
        this.whatsappService.sessionStatus.set(targetPhone, {
          ...currentStatus,
          status: 'pairing',
          pairingCode: code
        });
        return { message: 'Pairing code generated', result: { pairingCode: code } };
      } else {
        return { message: 'Already connected', result: { status: 'connected' } };
      }
    } catch (err) {
      console.error(`❌ Pairing Code Error:`, err.message);
      return { message: 'Failed to generate pairing code', result: null };
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
  async sendMessage(@Body() body: { phone: string; message: string; from?: string; mediaUrl?: string; mediaType?: string }, @Req() req: any) {
    const sender = (body.from || req.userNumber).toString().replace(/\D/g, '');
    const sock = this.whatsappService.sessions.get(sender);

    if (!sock || this.whatsappService.getStatus(sender).status !== 'connected') {
      return { status: false, message: `WhatsApp (${sender}) is disconnected.`, result: null };
    }

    const jid = body.phone.replace(/\D/g, '') + '@s.whatsapp.net';

    try {
      const messageOptions = await WhatsappUtils.prepareMessageOptions(body.message, body.mediaUrl, body.mediaType);

      if (!messageOptions) {
        return { status: false, message: 'Message content or media is required', result: null };
      }

      console.log(`📤 Sending message to ${jid}...`);
      const result = await sock.sendMessage(jid, messageOptions);

      await this.messageLogModel.create({
        sender,
        receiver: body.phone,
        message: body.message || '',
        status: 'sent',
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        messageId: result?.key?.id
      });

      const [stat] = await this.statModel.findOrCreate({ where: { id: 1 }, defaults: { totalMessagesSent: 0 } });
      await stat.increment('totalMessagesSent');

      return { status: true, message: 'Message sent successfully', result };
    } catch (err) {
      console.error(`❌ Send Message Error:`, err.message);
      return { status: false, message: 'Failed to send message: ' + err.message, result: null };
    }
  }

  @Post('broadcast')
  async broadcast(@Body() body: { numbers: string[]; message: string; from?: string; mediaUrl?: string; mediaType?: string }, @Req() req: any) {
    const sender = (body.from || req.userNumber).toString().replace(/\D/g, '');
    try {
      const results = await this.whatsappService.broadcast(
        sender,
        body.numbers,
        body.message,
        this.messageLogModel,
        this.statModel,
        body.mediaUrl,
        body.mediaType
      );
      return { message: 'Broadcast processed', result: { total: body.numbers.length, results } };
    } catch (err) {
      return { message: err.message, result: null };
    }
  }

  @Post('logout')
  async logout(@Body('phone') phone: string, @Req() req: any) {
    const targetPhone = (phone || req.userNumber).toString().replace(/\D/g, '');
    await this.whatsappService.forceLogout(targetPhone);
    return { message: 'Logged out successfully' };
  }
}
