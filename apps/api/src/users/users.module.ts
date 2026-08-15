import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../database/models/User';
import { Token } from '../database/models/Token';
import { Plan } from '../database/models/Plan';
import { Stat } from '../database/models/Stat';
import { MessageLog } from '../database/models/MessageLog';

@Module({
  imports: [SequelizeModule.forFeature([User, Token, Plan, Stat, MessageLog])],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
