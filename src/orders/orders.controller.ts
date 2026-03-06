import { Controller, Get, Post, Body, Param, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  /** Créer une commande : avec ou sans compte (invité). */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Request() req, @Body() orderData: any) {
    const userId = req.user?.sub ?? null;
    return this.ordersService.create(userId, orderData);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req) {
    return this.ordersService.findAll(req.user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Request() req, @Param('id') id: string) {
    const order = await this.ordersService.findOneForUser(id, req.user.sub);
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }
}
