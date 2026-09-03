import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import { qualityEvalUsers, qualityEvalSettings } from '@server/database/schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class InitService implements OnModuleInit {
  private readonly logger = new Logger(InitService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
    await this.ensureSuperAdmin();
    await this.ensureDefaultSettings();
    this.logger.log('数据库初始化完成');
  }

  private async ensureTables() {
    try {
      const sqlPath = path.join(process.cwd(), 'server/database/init.sql');
      if (fs.existsSync(sqlPath)) {
        const initSql = fs.readFileSync(sqlPath, 'utf-8');
        await this.db.execute(sql.raw(initSql));
        this.logger.log('数据库表初始化完成');
      } else {
        this.logger.warn('未找到 init.sql 文件，跳过表初始化');
      }
    } catch (error) {
      this.logger.error('数据库表初始化失败', error);
    }
  }

  private async ensureSuperAdmin() {
    const adminId = process.env.SUPER_ADMIN_ID || '0001';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.SUPER_ADMIN_NAME || '超级管理员';

    const existing = await this.db
      .select()
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.studentId, adminId))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(qualityEvalUsers).values({
        studentId: adminId,
        passwordHash: adminPassword,
        role: 'super_admin',
        displayName: adminName,
        className: '管理员',
      });
      this.logger.log(`已创建默认超级管理员: ${adminId}`);
    } else {
      this.logger.log(`超级管理员已存在: ${adminId}`);
    }
  }

  private async ensureDefaultSettings() {
    const existing = await this.db
      .select()
      .from(qualityEvalSettings)
      .where(eq(qualityEvalSettings.settingKey, 'fill_time'))
      .limit(1);

    if (existing.length === 0) {
      await this.db.insert(qualityEvalSettings).values({
        settingKey: 'fill_time',
        settingValue: JSON.stringify({ enabled: false, startTime: null, endTime: null }),
      });
      this.logger.log('已创建默认填写时间设置');
    }
  }
}
