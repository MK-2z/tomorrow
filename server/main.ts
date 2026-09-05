import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { __express as hbsExpressEngine } from 'hbs';
import * as fs from 'fs';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  const logger = new Logger('Bootstrap');
  const host = process.env.SERVER_HOST || '0.0.0.0';
  const port = Number(process.env.PORT || process.env.SERVER_PORT || '3000');

  // 启用 CORS
  app.enableCors();

  // 注册视图引擎, 渲染 client 目录下的 html 文件
  const viewsDir = join(process.cwd(), 'dist/client');
  if (fs.existsSync(viewsDir)) {
    app.setBaseViewsDir(viewsDir);
    app.setViewEngine('html');
    app.engine('html', hbsExpressEngine);
    app.useStaticAssets(viewsDir);
  }

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
