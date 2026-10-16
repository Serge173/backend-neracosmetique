import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Slide } from './entities/slide.entity';
import { SlidesService } from './slides.service';
import { SlidesController } from './slides.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Slide])],
  controllers: [SlidesController],
  providers: [SlidesService],
  exports: [SlidesService],
})
export class SlidesModule {}

