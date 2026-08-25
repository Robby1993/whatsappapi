import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Token } from '../database/models/Token';
import { User } from '../database/models/User';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Token)
    private tokenModel: typeof Token,
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async validateToken(tokenString: string): Promise<any> {
    const tokenData = await this.tokenModel.findOne({ where: { token: tokenString } });
    if (!tokenData) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userModel.findOne({ where: { number: tokenData.number } });
    if (!user || !user.isActive) {
      await this.tokenModel.destroy({ where: { token: tokenString } });
      throw new ForbiddenException('Access denied');
    }

    // Check subscription expiry for non-admin users if needed (legacy logic)
    if (user.userType === 'user') {
        const expiry = user.createdAt.getTime() + (user.validDays * 86400000);
        if (Date.now() > expiry) {
            await this.tokenModel.destroy({ where: { token: tokenString } });
            throw new ForbiddenException('Subscription expired');
        }
    }

    return {
      userNumber: user.number,
      userType: user.userType,
      isActive: user.isActive,
    };
  }
}
