import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Template } from '../database/models/Template';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template)
    private templateModel: typeof Template,
  ) {}

  async create(data: any, userNumber: string) {
    return await this.templateModel.create({ ...data, userNumber });
  }

  async findAll(userNumber: string) {
    return await this.templateModel.findAll({ where: { userNumber } });
  }

  async findOne(keyword: string, userNumber: string) {
    const template = await this.templateModel.findOne({ where: { keyword, userNumber } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async update(keyword: string, data: any, userNumber: string) {
    const template = await this.findOne(keyword, userNumber);
    return await template.update(data);
  }

  async delete(keyword: string, userNumber: string) {
    const template = await this.findOne(keyword, userNumber);
    return await template.destroy();
  }
}
