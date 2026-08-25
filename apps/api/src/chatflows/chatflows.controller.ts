import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ChatflowsService } from './chatflows.service';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('chatflows')
@UseGuards(TokenAuthGuard)
export class ChatflowsController {
  constructor(private chatflowsService: ChatflowsService) {}

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const result = await this.chatflowsService.create(body, req.userNumber);
    return { message: 'ChatFlow created', result };
  }

  @Get()
  async findAll(@Req() req: any) {
    const result = await this.chatflowsService.findAll(req.userNumber);
    return { message: 'ChatFlows fetched', result };
  }

  @Get(':id')
  async findOne(@Param('id') id: number, @Req() req: any) {
    const result = await this.chatflowsService.findOne(id, req.userNumber);
    return { message: 'ChatFlow fetched', result };
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    const result = await this.chatflowsService.update(id, body, req.userNumber);
    return { message: 'ChatFlow updated', result };
  }

  @Put(':id/toggle')
  async toggleActive(@Param('id') id: number, @Req() req: any) {
    const result = await this.chatflowsService.toggleActive(id, req.userNumber);
    return { message: 'ChatFlow status toggled', result };
  }

  @Delete(':id')
  async delete(@Param('id') id: number, @Req() req: any) {
    await this.chatflowsService.delete(id, req.userNumber);
    return { message: 'ChatFlow deleted' };
  }
}
