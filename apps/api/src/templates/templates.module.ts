import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { Template } from '../database/models/Template';

@Module({
  imports: [SequelizeModule.forFeature([Template])],
  providers: [TemplatesService],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
