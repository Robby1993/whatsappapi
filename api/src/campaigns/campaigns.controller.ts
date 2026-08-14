import { Controller, Post, Get, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('campaigns')
@UseGuards(TokenAuthGuard)
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const result = await this.campaignsService.create(body, req.userNumber);
    return { message: 'Campaign created', result };
  }

  @Get()
  async findAll(@Req() req: any) {
    const result = await this.campaignsService.findAll(req.userNumber);
    return { message: 'Campaigns fetched', result };
  }

  @Delete(':id')
  async delete(@Param('id') id: number, @Req() req: any) {
    await this.campaignsService.delete(id, req.userNumber);
    return { message: 'Campaign deleted' };
  }
}
