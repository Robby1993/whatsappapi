import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ChatFlow } from '../database/models/ChatFlow';

@Injectable()
export class ChatflowsService {
  constructor(
    @InjectModel(ChatFlow)
    private chatFlowModel: typeof ChatFlow,
  ) {}

  async create(data: any, userNumber: string) {
    const flowData = {
      ...data,
      userNumber,
      isActive: data.isActive ?? true
    };

    // Ensure triggerKeywords and steps are arrays if coming from frontend as JSON string or object
    if (typeof flowData.triggerKeywords === 'string') {
      flowData.triggerKeywords = flowData.triggerKeywords.split(',').map(k => k.trim());
    }

    return await this.chatFlowModel.create(flowData);
  }

  async findAll(userNumber: string) {
    return await this.chatFlowModel.findAll({
      where: { userNumber },
      order: [['createdAt', 'DESC']]
    });
  }

  async findOne(id: number, userNumber: string) {
    const flow = await this.chatFlowModel.findOne({ where: { id, userNumber } });
    if (!flow) throw new NotFoundException('ChatFlow not found');
    return flow;
  }

  async update(id: number, data: any, userNumber: string) {
    const flow = await this.chatFlowModel.findOne({ where: { id, userNumber } });
    if (!flow) throw new NotFoundException('ChatFlow not found');

    if (typeof data.triggerKeywords === 'string') {
      data.triggerKeywords = data.triggerKeywords.split(',').map(k => k.trim());
    }

    return await flow.update(data);
  }

  async delete(id: number, userNumber: string) {
    const flow = await this.chatFlowModel.findOne({ where: { id, userNumber } });
    if (!flow) throw new NotFoundException('ChatFlow not found');
    await flow.destroy();
    return true;
  }

  async toggleActive(id: number, userNumber: string) {
    const flow = await this.chatFlowModel.findOne({ where: { id, userNumber } });
    if (!flow) throw new NotFoundException('ChatFlow not found');
    await flow.update({ isActive: !flow.isActive });
    return flow;
  }
}
