import { Controller, Get } from '@nestjs/common';
import { SlidesService } from './slides.service';

@Controller('slides')
export class SlidesController {
  constructor(private readonly slidesService: SlidesService) {}

  @Get()
  getPublicSlides() {
    return this.slidesService.getPublicSlides();
  }
}

