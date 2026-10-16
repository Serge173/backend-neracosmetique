import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { ContactModule } from '../contact/contact.module';
import { SlidesModule } from '../slides/slides.module';

@Module({
  imports: [ProductsModule, OrdersModule, CategoriesModule, UsersModule, ContactModule, SlidesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
