import { Controller, Get, Param } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

@Controller('products/:id/reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get()
  async findAll(@Param('id') id: string) {
    return this.reviewsService.findAll(+id);
  }
}
