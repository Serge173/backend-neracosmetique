import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, getAllowedOrigins } from './app.setup';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);

  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}/api/v1`);
  console.log(`CORS: ${isProduction ? getAllowedOrigins().join(', ') : 'allow all (development)'}`);
}
bootstrap();
