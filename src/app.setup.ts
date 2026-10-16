import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';

const DEFAULT_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production') return fromEnv;
  return [...new Set([...fromEnv, ...DEFAULT_ORIGINS])];
}

export function configureApp(app: NestExpressApplication): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Derrière le proxy Vercel : nécessaire pour obtenir la vraie IP client (limitation de débit).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' },
      strictTransportSecurity: isProduction
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.enableCors({
    origin: isProduction ? getAllowedOrigins() : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    maxAge: 600,
  });

  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  if (!process.env.VERCEL) {
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads',
      dotfiles: 'deny',
      index: false,
    });
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
