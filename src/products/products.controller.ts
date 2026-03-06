import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async findAll(@Query() filters: any) {
    return this.productsService.findAll(filters);
  }

  @Get('featured')
  async findFeatured() {
    return this.productsService.findFeatured();
  }

  @Get('new')
  async findNew() {
    return this.productsService.findNew();
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }
}
