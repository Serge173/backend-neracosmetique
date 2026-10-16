import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SiteService } from './site.service';

@Controller('site')
export class SiteController {
  constructor(private site: SiteService) {}

  @Get('settings')
  async settings() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedAt, ...settings } = await this.site.getSettings();
    return settings;
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const { content, updatedAt } = await this.site.getPage(slug);
    return { content, updatedAt };
  }
}

@Controller('admin/site')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSiteController {
  constructor(private site: SiteService) {}

  @Get('settings')
  settings() {
    return this.site.getSettings();
  }

  @Put('settings')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  updateSettings(@Request() req, @Body() body: Record<string, unknown>) {
    return this.site.updateSettings(body, req.user.sub);
  }

  @Get('pages')
  pages() {
    return this.site.listPages();
  }

  @Get('pages/:slug')
  page(@Param('slug') slug: string) {
    return this.site.getPage(slug);
  }

  @Put('pages/:slug')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  updatePage(@Request() req, @Param('slug') slug: string, @Body() body: unknown) {
    return this.site.updatePage(slug, body, req.user.sub);
  }

  @Post('pages/:slug/reset')
  resetPage(@Param('slug') slug: string) {
    return this.site.resetPage(slug);
  }
}
