import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';

@Controller('templates')
@UseGuards(TokenAuthGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const result = await this.templatesService.create(body, req.userNumber);
    return { message: 'Template created', result };
  }

  @Get()
  async findAll(@Req() req: any) {
    const result = await this.templatesService.findAll(req.userNumber);
    return { message: 'Templates fetched', result };
  }

  @Get(':keyword')
  async findOne(@Param('keyword') keyword: string, @Req() req: any) {
    const result = await this.templatesService.findOne(keyword, req.userNumber);
    return { message: 'Template fetched', result };
  }

  @Put(':keyword')
  async update(@Param('keyword') keyword: string, @Body() body: any, @Req() req: any) {
    const result = await this.templatesService.update(keyword, body, req.userNumber);
    return { message: 'Template updated', result };
  }

  @Delete(':keyword')
  async delete(@Param('keyword') keyword: string, @Req() req: any) {
    await this.templatesService.delete(keyword, req.userNumber);
    return { message: 'Template deleted' };
  }
}
