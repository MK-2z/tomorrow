import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { QualityEvalModule } from './modules/quality-eval/quality-eval.module';
import { ViewModule } from './modules/view/view.module';
import { InitModule } from './modules/init/init.module';
import { DatabaseModule } from './database/database.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    QualityEvalModule,
    ViewModule,
    InitModule,
    UploadModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
