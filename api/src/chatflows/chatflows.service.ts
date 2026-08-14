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
    const flowData = { ...data, userNumber };
    if (flowData.triggerKeyword) flowData.triggerKeyword = flowData.triggerKeyword.trim();
    return await this.chatFlowModel.create(flowData);
  }

  async findAll(userNumber: string) {
    return await this.chatFlowModel.findAll({ where: { userNumber } });
  }

  async update(id: number, data: any, userNumber: string) {
    const flow = await this.chatFlowModel.findOne({ where: { id, userNumber } });
    if (!flow) throw new NotFoundException('ChatFlow not found');

    if (data.triggerKeyword) data.triggerKeyword = data.triggerKeyword.trim();
    return await flow.update(data);
  }

  async delete(id: number, userNumber: string) {
    return await this.chatFlowModel.destroy({ where: { id, userNumber } });
  }
}
