import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import { qualityEvalUsers, qualityEvalSettings, qualityEvalRecords } from '@server/database/schema';
import * as fs from 'fs';
import * as path from 'path';

// 已下线、需要从历史记录中清除的评分项目 projectKey 列表
const REMOVED_PROJECT_KEYS = ['ideological-basic'];

// 与前端 evalCategories.ts 保持一致的基础分配置
const BASE_SCORE_ITEMS: Record<string, number> = {
  'ideological-politics': 3,
  moral: 2,
  'law-abiding': 5,
  'physical-health': 5,
  civilized: 5,
};

// 与前端 evalCategories.ts 保持一致的二级指标上限配置
const ITEM_MAX_SCORES: Record<string, number> = {
  'ideological-politics': 10,
  moral: 5,
  'law-abiding': 5,
  'learning-attitude': 5,
  innovation: 15,
  'physical-health': 5,
  'sports-activity': 15,
  civilized: 5,
  'art-practice': 15,
  'labor-quality': 10,
  'labor-practice': 10,
  'social-work': 10,
  'college-special': 10,
};

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
    await this.cleanupRemovedProjects();
    this.logger.log('数据库初始化完成');
  }

  /**
   * 清理已下线评分项目的历史申报记录，并重算受影响记录的分数。
   * 幂等：若不存在相关记录则不做任何修改。
   */
  private async cleanupRemovedProjects() {
    try {
      const records = await this.db.select().from(qualityEvalRecords);
      let affectedCount = 0;

      for (const record of records) {
        const evalData: any = record.evalData;
        if (!evalData || !Array.isArray(evalData.categories)) continue;

        let changed = false;

        for (const category of evalData.categories) {
          if (!Array.isArray(category.items)) continue;
          for (const item of category.items) {
            if (!Array.isArray(item.reasons)) continue;
            const before = item.reasons.length;
            item.reasons = item.reasons.filter(
              (r: any) => !r || !REMOVED_PROJECT_KEYS.includes(r.projectKey),
            );
            if (item.reasons.length !== before) changed = true;
          }
        }

        if (!changed) continue;

        // 重算每个二级指标得分
        for (const category of evalData.categories) {
          if (!Array.isArray(category.items)) continue;
          for (const item of category.items) {
            item.itemScore = this.recomputeItemScore(item);
          }
          category.categoryScore = category.items.reduce(
            (s: number, it: any) => s + (Number(it.itemScore) || 0),
            0,
          );
        }

        // 重算总分（素质拓展 expansion 单独封顶 20 分）
        let regularScore = 0;
        let extraBonus = 0;
        for (const category of evalData.categories) {
          if (category.categoryKey === 'expansion') {
            const catSum = (category.items || []).reduce((s: number, item: any) => {
              return (
                s +
                (item.reasons || []).reduce(
                  (rSum: number, r: any) => rSum + Math.max(0, Number(r.score) || 0),
                  0,
                )
              );
            }, 0);
            extraBonus += Math.min(catSum, 20);
          } else {
            regularScore += Number(category.categoryScore) || 0;
          }
        }
        const newTotal = regularScore + extraBonus;

        await this.db
          .update(qualityEvalRecords)
          .set({
            evalData,
            totalScore: String(newTotal),
          } as any)
          .where(eq(qualityEvalRecords.id, record.id));

        affectedCount += 1;
      }

      if (affectedCount > 0) {
        this.logger.log(
          `已清理 ${affectedCount} 条评价记录中的已下线项目（${REMOVED_PROJECT_KEYS.join(', ')}）申报并重算分数`,
        );
      }
    } catch (error) {
      this.logger.error('清理已下线评分项目记录失败', error);
    }
  }

  /**
   * 与前端 computeItemScore 保持一致的分数重算逻辑
   */
  private recomputeItemScore(item: any): number {
    let positiveSum = 0;
    let negativeSum = 0;
    for (const r of item.reasons || []) {
      const score = Number(r.score) || 0;
      if (score >= 0) positiveSum += score;
      else negativeSum += score;
    }
    const base: number = item.itemKey ? BASE_SCORE_ITEMS[item.itemKey] ?? 0 : 0;
    const itemMaxScore: number | undefined = item.itemKey
      ? ITEM_MAX_SCORES[item.itemKey]
      : undefined;
    if (itemMaxScore !== undefined && itemMaxScore > 0) {
      const positiveCap = itemMaxScore - base;
      if (positiveCap > 0 && positiveSum > positiveCap) {
        positiveSum = positiveCap;
      } else if (positiveCap <= 0 && positiveSum > 0) {
        positiveSum = 0;
      }
    }
    return Math.max(0, positiveSum + negativeSum + base);
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
