import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChatflowsService } from './chatflows.service';
import { ChatflowsController } from './chatflows.controller';
import { ChatFlow } from '../database/models/ChatFlow';

@Module({
  imports: [SequelizeModule.forFeature([ChatFlow])],
  providers: [ChatflowsService],
  controllers: [ChatflowsController],
})
export class ChatflowsModule {}
