import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { Campaign } from '../database/models/Campaign';
import { QueuedMessage } from '../database/models/QueuedMessage';

@Module({
  imports: [SequelizeModule.forFeature([Campaign, QueuedMessage])],
  providers: [CampaignsService],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
