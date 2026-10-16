import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Post('validate')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async validate(@Request() req, @Body() body: { code: string; orderAmount?: number }) {
    return this.couponsService.validate(body?.code, body?.orderAmount, req.user?.sub ?? null);
  }
}
