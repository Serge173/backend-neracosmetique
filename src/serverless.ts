import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, NestExpressApplication } from '@nestjs/platform-express';
import express = require('express');
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

const server = express();
let ready: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });
  configureApp(app);
  await app.init();
}

export default async function handler(req: Request, res: Response): Promise<void> {
  if (!ready) {
    ready = bootstrap().catch((err) => {
      ready = null;
      throw err;
    });
  }
  await ready;
  server(req, res);
}
