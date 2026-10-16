import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from './common/client-ip-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { PaymentsModule } from './payments/payments.module';
import { CouponsModule } from './coupons/coupons.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ContactModule } from './contact/contact.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { AdminModule } from './admin/admin.module';
import { SlidesModule } from './slides/slides.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 100 },
    ]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...(process.env.DATABASE_URL
        ? {
            url: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: true },
          }
        : {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
          }),
      autoLoadEntities: true,
      synchronize: false,
      retryAttempts: process.env.VERCEL ? 2 : 9,
      retryDelay: process.env.VERCEL ? 1000 : 3000,
      extra: {
        max: process.env.VERCEL ? 3 : 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 15000,
      },
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CartModule,
    PaymentsModule,
    CouponsModule,
    ReviewsModule,
    ContactModule,
    NewsletterModule,
    SlidesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ClientIpThrottlerGuard,
    },
  ],
})
export class AppModule {}
