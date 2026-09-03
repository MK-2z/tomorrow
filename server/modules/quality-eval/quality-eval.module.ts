import { Module } from '@nestjs/common';
import { QualityEvalController } from './quality-eval.controller';
import { QualityEvalService } from './quality-eval.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [QualityEvalController],
  providers: [QualityEvalService],
})
export class QualityEvalModule {}
