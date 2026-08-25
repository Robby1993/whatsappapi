import { Injectable, ConflictException, NotFoundException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import * as crypto from 'crypto';
import { User } from '../database/models/User';
import { Token } from '../database/models/Token';
import { Plan } from '../database/models/Plan';
import { Stat } from '../database/models/Stat';
import { MessageLog } from '../database/models/MessageLog';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Token)
    private tokenModel: typeof Token,
    @InjectModel(Plan)
    private planModel: typeof Plan,
    @InjectModel(Stat)
    private statModel: typeof Stat,
    @InjectModel(MessageLog)
    private messageLogModel: typeof MessageLog,
  ) {}

  async register(data: any) {
    const { name, gender, number, password, userType } = data;
    const type = userType === 'admin' ? 'admin' : 'user';
    const cleanNumber = number.toString().replace(/\D/g, '');

    const existing = await this.userModel.findOne({
      where: { number: cleanNumber, userType: type },
    });

    if (existing) {
      throw new ConflictException(`An account with this number already exists as ${type}`);
    }

    const newUser = await this.userModel.create({
      number: cleanNumber,
      name: name || 'User',
      gender: gender || 'Not Specified',
      password,
      userType: type,
      validDays: 3,
    });

    const result = newUser.toJSON();
    delete result.password;
    return result;
  }

  async login(data: any) {
    const { number, password, userType } = data;
    const cleanNumber = number.toString().replace(/\D/g, '');

    const user = await this.userModel.findOne({
      where: { number: cleanNumber, userType: userType },
    });

    if (!user) {
      throw new NotFoundException(`User not found as ${userType}`);
    }

    if (user.password !== password) {
      throw new UnauthorizedException('Incorrect password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is currently inactive');
    }

    const token = crypto.randomBytes(24).toString('hex');
    await this.tokenModel.create({
      token,
      number: user.number,
      userType: user.userType,
    });

    const resultUser = user.toJSON();
    delete resultUser.password;

    return { token, user: resultUser };
  }

  async getDashboardData(userNumber: string, userType: string) {
    const user = await this.userModel.findOne({ where: { number: userNumber, userType } });
    const stat = await this.statModel.findOne({ where: { id: 1 } });
    const recentLogs = await this.messageLogModel.findAll({
      where: { sender: userNumber },
      order: [['timestamp', 'DESC']],
      limit: 5,
    });

    const result = user.toJSON();
    delete result.password;

    return {
      totalSent: stat ? stat.totalMessagesSent : 0,
      profile: result,
      recentLogs,
    };
  }

  async updateProfile(userNumber: string, userType: string, data: any) {
    await this.userModel.update(data, { where: { number: userNumber, userType } });
    const user = await this.userModel.findOne({ where: { number: userNumber, userType } });
    const result = user.toJSON();
    delete result.password;
    return result;
  }

  async buySubscription(userNumber: string, userType: string, planId: number) {
    const plan = await this.planModel.findByPk(planId);
    if (!plan) throw new NotFoundException('Invalid plan');

    const user = await this.userModel.findOne({ where: { number: userNumber, userType } });
    let newValidDays = user.validDays;
    let newCreatedAt = user.createdAt;

    const expiry = user.createdAt.getTime() + (user.validDays * 86400000);
    if (Date.now() < expiry) {
      newValidDays += plan.days;
    } else {
      newCreatedAt = new Date();
      newValidDays = plan.days;
    }

    await user.update({ validDays: newValidDays, createdAt: newCreatedAt });
    const result = user.toJSON();
    delete result.password;
    return result;
  }
}
