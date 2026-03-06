import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

const DEFAULT_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

function getAllowedOrigins(): string[] {
  const fromEnv = process.env.FRONTEND_URL;
  if (fromEnv) {
    return [...new Set([fromEnv.trim(), ...DEFAULT_ORIGINS])];
  }
  return DEFAULT_ORIGINS;
}

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const corsOptions = {
    origin: isProduction ? getAllowedOrigins() : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: corsOptions,
  });

  const uploadsPath = join(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Application is running on: http://${host}:${port}/api/v1`);
  console.log(`CORS: ${isProduction ? getAllowedOrigins().join(', ') : 'allow all (development)'}`);
}
bootstrap();
