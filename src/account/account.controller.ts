import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadedImageFile } from '../common/image-storage';
import { AccountService } from './account.service';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private account: AccountService) {}

  @Get('overview')
  overview(@Request() req) {
    return this.account.getOverview(req.user.sub);
  }

  @Get('favorites')
  favorites(@Request() req) {
    return this.account.getFavorites(req.user.sub);
  }

  @Get('favorites/ids')
  favoriteIds(@Request() req) {
    return this.account.getFavoriteIds(req.user.sub);
  }

  @Post('favorites/:productId')
  addFavorite(@Request() req, @Param('productId', ParseIntPipe) productId: number) {
    return this.account.addFavorite(req.user.sub, productId);
  }

  @Delete('favorites/:productId')
  removeFavorite(@Request() req, @Param('productId', ParseIntPipe) productId: number) {
    return this.account.removeFavorite(req.user.sub, productId);
  }

  @Get('addresses')
  addresses(@Request() req) {
    return this.account.getAddresses(req.user.sub);
  }

  @Post('addresses')
  createAddress(@Request() req, @Body() body: Record<string, unknown>) {
    return this.account.createAddress(req.user.sub, body);
  }

  @Patch('addresses/:id')
  updateAddress(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() body: Record<string, unknown>) {
    return this.account.updateAddress(req.user.sub, id, body);
  }

  @Delete('addresses/:id')
  deleteAddress(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.account.deleteAddress(req.user.sub, id);
  }

  @Get('reviews')
  reviews(@Request() req) {
    return this.account.getReviews(req.user.sub);
  }

  @Post('reviews')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  createReview(@Request() req, @Body() body: Record<string, unknown>) {
    return this.account.createReview(req.user.sub, body);
  }

  @Delete('reviews/:id')
  deleteReview(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.account.deleteReview(req.user.sub, id);
  }

  @Post('avatar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  uploadAvatar(@Request() req, @UploadedFile() file: UploadedImageFile) {
    return this.account.setAvatar(req.user.sub, file, `${req.protocol}://${req.get('host')}`);
  }

  @Delete('avatar')
  removeAvatar(@Request() req) {
    return this.account.removeAvatar(req.user.sub);
  }

  @Get('loyalty')
  loyalty(@Request() req) {
    return this.account.getLoyalty(req.user.sub);
  }

  @Post('loyalty/redeem')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  redeem(@Request() req, @Body() body: Record<string, unknown>) {
    return this.account.redeemPoints(req.user.sub, body);
  }
}
