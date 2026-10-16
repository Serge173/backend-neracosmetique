import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminInsightsService } from './admin-insights.service';
import { ProductsModule } from '../products/products.module';
import { OrdersModule } from '../orders/orders.module';
import { CategoriesModule } from '../categories/categories.module';
import { UsersModule } from '../users/users.module';
import { ContactModule } from '../contact/contact.module';
import { SlidesModule } from '../slides/slides.module';
import { Coupon } from '../coupons/entities/coupon.entity';
import { Review } from '../reviews/entities/review.entity';
import { NewsletterSubscriber } from '../newsletter/entities/newsletter-subscriber.entity';
import { DeliveryZone } from '../orders/entities/delivery-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Coupon, Review, NewsletterSubscriber, DeliveryZone]),
    ProductsModule,
    OrdersModule,
    CategoriesModule,
    UsersModule,
    ContactModule,
    SlidesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminInsightsService],
})
export class AdminModule {}
