import { Controller, Post, Body } from '@nestjs/common';
import { CouponsService } from './coupons.service';

@Controller('coupons')
export class CouponsController {
  constructor(private couponsService: CouponsService) {}

  @Post('validate')
  async validate(@Body() body: { code: string; orderAmount?: number }) {
    return this.couponsService.validate(body.code, body.orderAmount);
  }
}
