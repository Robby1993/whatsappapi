import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { TokenAuthGuard } from '../auth/guards/token-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin')
@UseGuards(TokenAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    const result = await this.adminService.getStats();
    return { message: 'System stats fetched', result };
  }

  @Get('users')
  async getUsers(@Query('includeDeleted') includeDeleted: string) {
    const result = await this.adminService.getUsers(includeDeleted === 'true');
    return { message: 'Users fetched successfully', result };
  }

  @Post('update-user')
  async updateUser(@Body() body: any) {
    const result = await this.adminService.updateUser(body.number, body);
    return { message: 'User updated successfully', result };
  }

  @Delete('users/:number/soft')
  async softDelete(@Param('number') number: string, @Query('userType') userType: string) {
    await this.adminService.softDeleteUser(number, userType);
    return { message: `User ${number} soft deleted successfully.` };
  }

  @Delete('users/:number/hard')
  async hardDelete(@Param('number') number: string, @Query('userType') userType: string) {
    await this.adminService.hardDeleteUser(number, userType);
    return { message: `User ${number} permanently deleted.` };
  }

  @Post('plans')
  async savePlan(@Body() body: any) {
    const result = await this.adminService.savePlan(body);
    return { message: 'Plan saved successfully', result };
  }

  @Post('clear-database')
  async clearDatabase() {
    await this.adminService.clearDatabase();
    return { message: 'Database cleared (except admin users)' };
  }
}
