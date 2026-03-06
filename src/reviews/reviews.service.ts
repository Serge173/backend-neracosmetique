import { Injectable } from '@nestjs/common';

@Injectable()
export class ReviewsService {
  async findAll(productId: number) {
    return [];
  }
}
