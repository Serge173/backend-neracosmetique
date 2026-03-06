import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.findOne(req.user.sub);
  }

  @Patch('me')
  async updateMe(@Request() req, @Body() data: any) {
    return this.usersService.update(req.user.sub, data);
  }

  @Get('me/orders')
  async getMyOrders(@Request() req) {
    // Implémenter récupération commandes utilisateur
    return [];
  }
}
