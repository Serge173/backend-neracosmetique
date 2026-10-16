import { Module } from '@nestjs/common';
import { AdminSiteController, SiteController } from './site.controller';
import { SiteService } from './site.service';

@Module({
  controllers: [SiteController, AdminSiteController],
  providers: [SiteService],
})
export class SiteModule {}
