import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from './models/User';
import { Token } from './models/Token';
import { Session } from './models/Session';
import { ChatFlow } from './models/ChatFlow';
import { Campaign } from './models/Campaign';
import { QueuedMessage } from './models/QueuedMessage';
import { ScheduledMessage } from './models/ScheduledMessage';
import { MessageLog } from './models/MessageLog';
import { Stat } from './models/Stat';
import { Template } from './models/Template';
import { Plan } from './models/Plan';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');

        if (!dbUrl) {
          throw new Error('DATABASE_URL environment variable is not defined');
        }

        const isRender = dbUrl.includes('render.com');

        return {
          dialect: 'postgres',
          uri: dbUrl,
          models: [
            User,
            Token,
            Session,
            ChatFlow,
            Campaign,
            QueuedMessage,
            ScheduledMessage,
            MessageLog,
            Stat,
            Template,
            Plan,
          ],
          autoLoadModels: true,
          synchronize: true,
          sync: {
            alter: true,
          },
          logging: false,
          dialectOptions: {
            ssl: isRender
              ? {
                  require: true,
                  rejectUnauthorized: false,
                }
              : false,
            keepAlive: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    SequelizeModule.forFeature([
      User,
      Token,
      Session,
      ChatFlow,
      Campaign,
      QueuedMessage,
      ScheduledMessage,
      MessageLog,
      Stat,
      Template,
      Plan,
    ]),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
