import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BrandsController } from './brands.controller';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Brand } from './entities/brand.entity';
import { Category } from '../categories/entities/category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductImage, Brand, Category])],
  controllers: [ProductsController, BrandsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
