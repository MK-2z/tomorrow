import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  const logger = new Logger('Bootstrap');
  const host = '0.0.0.0';
  const port = Number(process.env.PORT || process.env.SERVER_PORT || '3000');

  // 启用 CORS
  app.enableCors();

  // 提供前端静态资源
  const clientDistDir = join(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDistDir)) {
    // 直接使用 Express 静态资源中间件，不使用模板引擎
    app.use(express.static(clientDistDir));

    // 对于所有非 API、非静态资源的 GET 请求，返回 index.html（支持 React Router 客户端路由）
    app.use((req, res, next) => {
      // 只处理 GET 请求
      if (req.method !== 'GET') {
        return next();
      }
      // API 请求不处理
      if (req.path.startsWith('/api/')) {
        return next();
      }
      // 静态资源请求（包含文件扩展名）不处理，让 express.static 处理
      if (req.path.includes('.') && !req.path.endsWith('/')) {
        return next();
      }
      // 其他请求返回 index.html
      const indexPath = join(clientDistDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });

    logger.log('Frontend static files served from dist/client');
  } else {
    logger.warn('Frontend dist directory not found: ' + clientDistDir);
  }

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
