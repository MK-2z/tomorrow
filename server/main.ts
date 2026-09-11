import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join, extname, basename } from 'path';
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

  // 提供上传文件静态资源
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '7d',
    fallthrough: true,
    setHeaders: (res, filePath) => {
      // 确保浏览器正确识别文件类型，避免二进制文件被当作文本渲染而乱码
      const ext = extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.txt': 'text/plain; charset=utf-8',
        '.zip': 'application/zip', '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed', '.gz': 'application/gzip',
        '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
      // 图片和PDF在浏览器中内联预览，其他文件强制下载（避免浏览器把二进制当文本打开而乱码）
      const inlineExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.pdf'];
      if (!inlineExts.includes(ext)) {
        const fileName = basename(filePath);
        // RFC 5987 标准编码，兼容中文及各类浏览器的下载文件名
        const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        );
      } else {
        res.setHeader('Content-Disposition', 'inline');
      }
      // 防止浏览器对响应做错误的 MIME 嗅探
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  }));
  // /uploads 下找不到文件时显式返回 404，避免 fallthrough 到 SPA 返回 index.html（会被当成乱码文件）
  app.use('/uploads', (_req, res) => {
    res.status(404).json({ success: false, message: '文件不存在或已被清理' });
  });
  logger.log('Uploads static files configured: ' + uploadsDir);

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
