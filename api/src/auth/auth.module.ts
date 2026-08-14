import { Module, Global } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthService } from './auth.service';
import { Token } from '../database/models/Token';
import { User } from '../database/models/User';
import { TokenAuthGuard } from './guards/token-auth.guard';
import { AdminGuard } from './guards/admin.guard';

@Global()
@Module({
  imports: [SequelizeModule.forFeature([Token, User])],
  providers: [AuthService, TokenAuthGuard, AdminGuard],
  exports: [AuthService, TokenAuthGuard, AdminGuard],
})
export class AuthModule {}
