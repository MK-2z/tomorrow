import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'uploads');

// 确保上传目录存在
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Controller('api/upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const safeName = file.originalname
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
            .slice(0, 50);
          cb(null, `${uniqueSuffix}-${safeName}${ext}`);
        },
      }),
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
      },
      fileFilter: (_req, file, cb) => {
        // 允许常见格式：图片、文档、压缩包、PDF等
        const allowedTypes = [
          // 图片
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/svg+xml',
          // 文档
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          // 压缩包
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          'application/gzip',
          // 视频
          'video/mp4',
          'video/quicktime',
          'video/x-msvideo',
          // 音频
          'audio/mpeg',
          'audio/wav',
          'audio/ogg',
        ];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('不支持的文件类型'), false);
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: boolean; data: { url: string; name: string; size: number } }> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    this.logger.log(
      `文件上传成功: ${file.originalname} -> ${file.filename} (${(file.size / 1024).toFixed(1)} KB)`,
    );

    return {
      success: true,
      data: {
        url: `/uploads/${file.filename}`,
        name: file.originalname,
        size: file.size,
      },
    };
  }
}
