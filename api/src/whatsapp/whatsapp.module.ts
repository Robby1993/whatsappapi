import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PostgresAuthService } from './postgres-auth.service';
import { IncomingMessageHandler } from './incoming-message-handler.service';
import { Session } from '../database/models/Session';
import { User } from '../database/models/User';
import { ChatFlow } from '../database/models/ChatFlow';
import { MessageLog } from '../database/models/MessageLog';
import { Stat } from '../database/models/Stat';

@Module({
  imports: [
    SequelizeModule.forFeature([Session, User, ChatFlow, MessageLog, Stat]),
  ],
  providers: [
    WhatsappService,
    PostgresAuthService,
    IncomingMessageHandler,
  ],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
