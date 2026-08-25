import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Campaign } from '../database/models/Campaign';
import { QueuedMessage } from '../database/models/QueuedMessage';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign)
    private campaignModel: typeof Campaign,
    @InjectModel(QueuedMessage)
    private queuedMessageModel: typeof QueuedMessage,
  ) {}

  async create(data: any, userNumber: string) {
    const sender = (data.from || userNumber).toString().replace(/\D/g, '');
    const { name, message, numbers, scheduledAt } = data;

    const parsedScheduledAt = scheduledAt && !isNaN(new Date(scheduledAt).getTime())
      ? new Date(scheduledAt)
      : null;

    const campaign = await this.campaignModel.create({
      name,
      sender,
      message,
      totalContacts: numbers.length,
      scheduledAt: parsedScheduledAt,
    });

    const queued = numbers.map((num: string) => ({
      sender,
      receiver: num,
      message,
      campaignId: campaign.id,
      scheduledAt: parsedScheduledAt,
    }));

    await this.queuedMessageModel.bulkCreate(queued);
    return campaign;
  }

  async findAll(sender: string) {
    return await this.campaignModel.findAll({
      where: { sender },
      order: [['createdAt', 'DESC']],
    });
  }

  async delete(id: number, sender: string) {
    const campaign = await this.campaignModel.findOne({ where: { id, sender } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    await this.queuedMessageModel.destroy({ where: { campaignId: id } });
    await campaign.destroy();
    return true;
  }
}
