import { Module } from '@nestjs/common';
import { DatabaseModule } from '@server/database/database.module';
import { InitService } from './init.service';

@Module({
  imports: [DatabaseModule],
  providers: [InitService],
})
export class InitModule {}
