import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getCart(@Request() req: { user?: { sub: string } }) {
    const userId = req.user?.sub ?? null;
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  async addItem(@Request() req: { user: { sub: string } }, @Body() body: AddCartItemDto) {
    return this.cartService.addItem(req.user.sub, body.productId, body.quantity);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard)
  async updateItem(@Request() req: { user: { sub: string } }, @Param('id') id: string, @Body() body: { quantity: number }) {
    return this.cartService.updateItemQuantity(req.user.sub, parseInt(id, 10), body.quantity);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard)
  async removeItem(@Request() req: { user: { sub: string } }, @Param('id') id: string) {
    return this.cartService.removeItem(req.user.sub, parseInt(id, 10));
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async clearCart(@Request() req: { user: { sub: string } }) {
    return this.cartService.clearCart(req.user.sub);
  }
}
