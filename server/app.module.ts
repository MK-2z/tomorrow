import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { QualityEvalModule } from './modules/quality-eval/quality-eval.module';
import { ViewModule } from './modules/view/view.module';
import { InitModule } from './modules/init/init.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    QualityEvalModule,
    ViewModule,
    InitModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
