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
    logger.log('Serving frontend from: ' + clientDistDir);

    // 列出 dist/client 目录下的文件，用于调试
    try {
      const files = fs.readdirSync(clientDistDir);
      logger.log('dist/client contents: ' + JSON.stringify(files));
      const assetsDir = join(clientDistDir, 'assets');
      if (fs.existsSync(assetsDir)) {
        const assets = fs.readdirSync(assetsDir);
        logger.log('dist/client/assets contents: ' + JSON.stringify(assets));
      }
    } catch (e) {
      logger.error('Failed to list dist/client: ' + String(e));
    }

    // 使用 Express 静态资源中间件
    app.use(express.static(clientDistDir, {
      index: false, // 不自动返回 index.html，让我们自己处理
      maxAge: '1h',
    }));

    // 对于所有非 API 的 GET 请求，如果文件不存在，则返回 index.html（支持 React Router）
    app.use((req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      if (req.path.startsWith('/api/')) {
        return next();
      }
      if (req.path.startsWith('/uploads/')) {
        return next();
      }

      // 检查请求的文件是否存在于 dist/client 目录
      const requestedPath = join(clientDistDir, req.path);
      if (fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()) {
        // 文件存在，express.static 应该已经处理了
        return next();
      }

      // 文件不存在，返回 index.html
      const indexPath = join(clientDistDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        logger.log('SPA fallback: ' + req.path + ' -> index.html');
        return res.sendFile(indexPath);
      }
      next();
    });

    logger.log('Frontend static files configured');
  } else {
    logger.warn('Frontend dist directory not found: ' + clientDistDir);
  }

  await app.listen(port, host);
  logger.log(`Server running on ${host}:${port}`);
  logger.log(`API endpoints ready at http://${host}:${port}/api`);
}

bootstrap();
