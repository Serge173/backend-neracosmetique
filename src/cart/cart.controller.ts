import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Logger } from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@Controller('cart')
export class CartController {
  private readonly logger = new Logger(CartController.name);

  constructor(private cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getCart(@Request() req: { user?: { sub: string } }) {
    try {
      const userId = req.user?.sub ?? null;
      return await this.cartService.getCart(userId);
    } catch (err) {
      this.logger.error('GET /cart failed', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  async addItem(@Request() req: { user: { sub: string } }, @Body() body: AddCartItemDto) {
    try {
      return await this.cartService.addItem(req.user.sub, body.productId, body.quantity);
    } catch (err) {
      this.logger.error('POST /cart/items failed', err instanceof Error ? err.stack : String(err));
      throw err;
    }
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
