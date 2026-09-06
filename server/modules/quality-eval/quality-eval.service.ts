import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { qualityEvalRecords, qualityEvalSettings } from '@server/database/schema';
import { eq, and, ilike, or, desc, asc, count, inArray, sql } from 'drizzle-orm';
import { AuthService } from '../auth/auth.service';
import type {
  CreateQualityEvalDto,
  UpdateQualityEvalDto,
  QualityEvalRecord,
  QualityEvalListResponse,
  EvalCategory,
  EvalItem,
  EvalReason,
  ReviewStatus,
  ReviewQualityEvalDto,
  ReviewCheckSummary,
  ReviewItemDto,
  ReviewReasonDto,
  ItemReviewState,
  ReasonReviewStatus,
  FillTimeSettings,
  FillTimeSettingsDto,
  QualityEvalListStats,
} from '@shared/api.interface';

type QualityEvalSelect = typeof qualityEvalRecords.$inferSelect;
type QualityEvalInsert = typeof qualityEvalRecords.$inferInsert;

interface ReviewInfo {
  status: ReviewStatus;
  comment?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

interface EvalDataJson {
  categories: EvalCategory[];
  qualityScore?: number;
  academicScore?: number | null;
  comprehensiveScore?: number | null;
  review?: ReviewInfo;
}

const EXTRA_CATEGORY_KEY = 'expansion';
const EXTRA_MAX_SCORE = 20;

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function migrateReasonsWithIds(categories: EvalCategory[]): EvalCategory[] {
  return categories.map((cat: EvalCategory) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      reasons: (item.reasons ?? []).map((r: EvalReason, idx: number) => {
        if (r.id) return r;
        const reasonId = genId(`${item.itemKey}-r${idx}`);
        return {
          ...r,
          id: reasonId,
          type: r.type ?? (r.score >= 0 ? 'positive' : 'negative'),
          proofFiles: (r.proofFiles ?? []).map((f) => ({ ...f, reasonId })),
        };
      }),
    })),
  }));
}

@Injectable()
export class QualityEvalService {
  private readonly logger = new Logger(QualityEvalService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly authService: AuthService,
  ) {}

  private safeLogOperation(
    operatorStudentId: string,
    operatorName: string,
    operatorRole: string,
    operationType: string,
    targetStudentId?: string,
    targetStudentName?: string,
    detail?: string,
  ): void {
    // 日志写入不影响主流程，失败仅记录错误
    this.authService
      .logOperation(
        operatorStudentId,
        operatorName || operatorStudentId,
        operatorRole,
        operationType,
        targetStudentId,
        targetStudentName,
        detail,
      )
      .catch((err: unknown) => {
        this.logger.error(
          `操作日志写入失败: ${operationType} - ${JSON.stringify(err)}`,
        );
      });
  }

  private mapToDto(row: QualityEvalSelect): QualityEvalRecord {
    const evalData = (row.evalData ?? {}) as EvalDataJson;
    const review = evalData.review ?? { status: 'pending' as ReviewStatus };
    const categories = migrateReasonsWithIds(evalData.categories ?? []);

    const qualityScore = evalData.qualityScore ?? Number(row.totalScore);

    const itemStatus = (row.reviewItemStatus ?? {}) as Record<string, ItemReviewState>;

    const resubmitted = Boolean(row.resubmitted);

    const reasonStatus = (row.reviewReasonStatus ?? {}) as Record<string, { status: ReasonReviewStatus; comment?: string; reviewerId?: string; reviewerName?: string; reviewedAt?: string }>;

    // 注入原因级审查状态
    for (const cat of categories) {
      for (const item of cat.items) {
        for (const reason of item.reasons) {
          const rs = reasonStatus[reason.id];
          if (rs) {
            reason.reviewStatus = rs.status;
            reason.reviewComment = rs.comment;
            reason.reviewerId = rs.reviewerId;
            reason.reviewerName = rs.reviewerName;
            reason.reviewedAt = rs.reviewedAt;
          }
        }
      }
    }

    return {
      id: row.id,
      studentId: row.studentId,
      className: row.className,
      studentName: row.studentName,
      totalScore: Number(row.totalScore),
      qualityScore,
      academicScore: evalData.academicScore ?? null,
      comprehensiveScore: evalData.comprehensiveScore ?? null,
      categories,
      reviewStatus: review.status ?? 'pending',
      reviewComment: review.comment,
      reviewAt: review.reviewedAt,
      reviewBy: review.reviewedBy,
      reviewItemStatus: itemStatus,
      resubmitted,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(
    dto: CreateQualityEvalDto,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    if (!dto.studentId || !dto.studentName || !dto.className) {
      throw new BadRequestException('学号、姓名和班级不能为空');
    }

    const isStudentOperator =
      options?.operatorRole === 'student' && options?.operatorStudentId;

    if (isStudentOperator) {
      const existingRecord = await this.findStudentRecord(
        dto.studentId,
      );
      if (existingRecord) {
        throw new BadRequestException(
          '您已提交过评价，如需修改请在原有记录上操作',
        );
      }
    }

    const categories = migrateReasonsWithIds(dto.categories ?? []);

    const insertData: QualityEvalInsert = {
      studentId: dto.studentId,
      className: dto.className,
      studentName: dto.studentName,
      totalScore: String(dto.totalScore ?? 0),
      evalData: {
        categories,
        qualityScore: dto.qualityScore ?? dto.totalScore ?? 0,
        academicScore: dto.academicScore ?? null,
        comprehensiveScore: dto.comprehensiveScore ?? null,
        review: { status: 'pending' },
      },
      proofFiles: { files: [] },
      reviewItemStatus: {},
    };

    const rows = await this.db
      .insert(qualityEvalRecords)
      .values(insertData)
      .returning();

    if (rows.length === 0) {
      throw new BadRequestException('创建失败');
    }

    this.logger.log(`创建素质评价记录: ${rows[0].id}`);

    const record = this.mapToDto(rows[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        'submit_eval',
        record.studentId,
        record.studentName,
        `提交素质评价，总分：${record.totalScore}`,
      );
    }

    return record;
  }

  private async findStudentRecord(studentId: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: qualityEvalRecords.id })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.studentId, studentId))
      .limit(1);
    return rows.length > 0 ? rows[0].id : null;
  }

  async list(params: {
    page: number;
    pageSize: number;
    keyword?: string;
    studentId?: string;
    studentName?: string;
    className?: string;
    reviewStatus?: ReviewStatus | 'returned';
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    studentIds?: string[];
    studentNames?: string[];
    classNames?: string[];
    reviewStatuses?: string[];
  }): Promise<QualityEvalListResponse> {
    const {
      page,
      pageSize,
      keyword,
      studentId,
      studentName,
      className: classFilter,
      reviewStatus: statusFilter,
      sortField,
      sortOrder,
      studentIds,
      studentNames,
      classNames,
      reviewStatuses,
    } = params;

    const conditions = [];
    if (keyword) {
      const kw = `%${keyword}%`;
      conditions.push(
        or(
          ilike(qualityEvalRecords.studentId, kw),
          ilike(qualityEvalRecords.studentName, kw),
          ilike(qualityEvalRecords.className, kw),
        ),
      );
    }
    if (studentId) {
      conditions.push(ilike(qualityEvalRecords.studentId, `%${studentId}%`));
    }
    if (studentName) {
      conditions.push(ilike(qualityEvalRecords.studentName, `%${studentName}%`));
    }
    if (classFilter) {
      conditions.push(ilike(qualityEvalRecords.className, `%${classFilter}%`));
    }
    if (studentIds && studentIds.length > 0) {
      conditions.push(inArray(qualityEvalRecords.studentId, studentIds));
    }
    if (studentNames && studentNames.length > 0) {
      conditions.push(inArray(qualityEvalRecords.studentName, studentNames));
    }
    if (classNames && classNames.length > 0) {
      conditions.push(inArray(qualityEvalRecords.className, classNames));
    }
    const statusExpr = sql`(${qualityEvalRecords.evalData}->'review'->>'status')::text`;
    if (statusFilter) {
      if (statusFilter === 'returned') {
        conditions.push(
          sql`(${statusExpr} = ${'needs_revision'} OR ${statusExpr} = ${'rejected'})`,
        );
      } else {
        conditions.push(sql`${statusExpr} = ${statusFilter}`);
      }
    }
    if (reviewStatuses && reviewStatuses.length > 0) {
      conditions.push(
        sql`${statusExpr} = ANY(ARRAY[${sql.join(reviewStatuses.map((s: string) => sql`${s}`), sql`, `)}]::text[])`,
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * pageSize;

    let orderExpr = desc(qualityEvalRecords.createdAt);
    if (sortField) {
      const isAsc = sortOrder === 'asc';
      switch (sortField) {
        case 'studentId':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.studentId)
            : desc(qualityEvalRecords.studentId);
          break;
        case 'studentName':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.studentName)
            : desc(qualityEvalRecords.studentName);
          break;
        case 'className':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.className)
            : desc(qualityEvalRecords.className);
          break;
        case 'totalScore':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.totalScore)
            : desc(qualityEvalRecords.totalScore);
          break;
        case 'reviewStatus':
          orderExpr = isAsc ? asc(statusExpr) : desc(statusExpr);
          break;
        case 'createdAt':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.createdAt)
            : desc(qualityEvalRecords.createdAt);
          break;
        default:
          break;
      }
    }

    const [rows, countResult, statsRows] = await Promise.all([
      this.db
        .select()
        .from(qualityEvalRecords)
        .where(whereClause)
        .orderBy(orderExpr)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(qualityEvalRecords)
        .where(whereClause),
      this.db
        .select({
          statusKey: statusExpr.as('status_key'),
          statusCount: sql`count(*)::bigint`.as('status_count'),
        })
        .from(qualityEvalRecords)
        .where(whereClause)
        .groupBy(statusExpr),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row: QualityEvalSelect) => this.mapToDto(row));

    const stats: QualityEvalListStats = {
      all: total,
      pending: 0,
      approved: 0,
      returned: 0,
    };
    for (const row of statsRows) {
      const key = String(row.statusKey ?? 'pending');
      const cnt = Number(row.statusCount ?? 0);
      if (key === 'pending') {
        stats.pending = cnt;
      } else if (key === 'approved') {
        stats.approved = cnt;
      } else if (key === 'needs_revision' || key === 'rejected') {
        stats.returned += cnt;
      }
    }

    return {
      items,
      total,
      page,
      pageSize,
      stats,
    };
  }

  async getDistinctColumnValues(field: string, keyword?: string): Promise<string[]> {
    let queryExpr;
    switch (field) {
      case 'studentId':
        queryExpr = qualityEvalRecords.studentId;
        break;
      case 'studentName':
        queryExpr = qualityEvalRecords.studentName;
        break;
      case 'className':
        queryExpr = qualityEvalRecords.className;
        break;
      case 'reviewStatus': {
        const rows = await this.db
          .select({
            value: sql`(${qualityEvalRecords.evalData}->'review'->>'status')::text`.as(
              'value',
            ),
          })
          .from(qualityEvalRecords)
          .groupBy(sql`value`)
          .orderBy(sql`value`);
        let result = rows
          .filter((r: { value: string }) => Boolean(r.value))
          .map((r: { value: string }) => r.value);
        if (keyword) {
          result = result.filter((v: string) =>
            v.toLowerCase().includes(keyword.toLowerCase()),
          );
        }
        return result;
      }
      default:
        throw new BadRequestException(`不支持的字段: ${field}`);
    }

    const conditions = [];
    if (keyword) {
      conditions.push(ilike(queryExpr as any, `%${keyword}%`));
    }
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({ value: queryExpr })
      .from(qualityEvalRecords)
      .where(whereClause)
      .groupBy(queryExpr as any)
      .orderBy(queryExpr as any)
      .limit(200);

    return rows
      .filter((r: { value: string | null }) => r.value != null && r.value !== '')
      .map((r: { value: string | null }) => String(r.value));
  }

  async getById(id: string): Promise<QualityEvalRecord> {
    const rows = await this.db
      .select()
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    return this.mapToDto(rows[0]);
  }

  private collectReasonSignatures(reasons: EvalReason[]): string[] {
    return reasons
      .slice()
      .sort((a: EvalReason, b: EvalReason) => a.id.localeCompare(b.id))
      .map((r: EvalReason) =>
        JSON.stringify({
          reason: r.reason,
          score: r.score,
          type: r.type,
          projectKey: r.projectKey,
          levelKey: r.levelKey,
          optionKey: r.optionKey,
          remark: r.remark ?? '',
          proofFiles: (r.proofFiles ?? []).map((f) => f.url).sort(),
        }),
      );
  }

  private hasItemChanged(
    oldCats: EvalCategory[],
    newCats: EvalCategory[],
    itemKey: string,
  ): boolean {
    const findItem = (cats: EvalCategory[], key: string): EvalItem | null => {
      for (const cat of cats) {
        for (const item of cat.items) {
          if (item.itemKey === key) return item;
        }
      }
      return null;
    };
    const oldItem = findItem(oldCats, itemKey);
    const newItem = findItem(newCats, itemKey);
    const oldSigs = oldItem ? this.collectReasonSignatures(oldItem.reasons) : [];
    const newSigs = newItem ? this.collectReasonSignatures(newItem.reasons) : [];
    if (oldSigs.length !== newSigs.length) return true;
    for (let i = 0; i < oldSigs.length; i += 1) {
      if (oldSigs[i] !== newSigs[i]) return true;
    }
    return false;
  }

  async update(
    id: string,
    dto: UpdateQualityEvalDto,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    const existing = await this.db
      .select({
        id: qualityEvalRecords.id,
        evalData: qualityEvalRecords.evalData,
        studentId: qualityEvalRecords.studentId,
        reviewItemStatus: qualityEvalRecords.reviewItemStatus,
        resubmitted: qualityEvalRecords.resubmitted,
      })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    const isStudentOperator = (options?.operatorRole === 'student' || (options?.operatorRole === 'admin' && Boolean(options?.operatorStudentId))) && options?.operatorStudentId;
    const currentEval = (existing[0].evalData ?? {}) as EvalDataJson;
    const currentStatus = currentEval.review?.status ?? 'pending';
    const currentItemStatus = (existing[0].reviewItemStatus ??
      {}) as Record<string, ItemReviewState>;

    if (isStudentOperator) {
      if (existing[0].studentId !== options!.operatorStudentId) {
        throw new BadRequestException('学生只能修改自己的评价记录');
      }
      if (currentStatus === 'pending' || currentStatus === 'approved') {
        throw new BadRequestException(
          '当前记录不可修改，请等待审查结果',
        );
      }
      if (currentStatus === 'needs_revision') {
        const hasNeedsRevisionItem = Object.values(currentItemStatus)
          .some((s: ItemReviewState) => s.status === 'needs_revision');
        if (!hasNeedsRevisionItem) {
          throw new BadRequestException(
            '当前记录不在待修改状态，无法修改',
          );
        }
      }
    }

    const patch: Partial<QualityEvalInsert> = {};
    const nextEval: EvalDataJson = { ...currentEval };

    if (dto.studentId !== undefined) patch.studentId = dto.studentId;
    if (dto.className !== undefined) patch.className = dto.className;
    if (dto.studentName !== undefined) patch.studentName = dto.studentName;
    if (dto.totalScore !== undefined) {
      patch.totalScore = String(dto.totalScore);
    }
    if (dto.categories !== undefined) {
      nextEval.categories = migrateReasonsWithIds(dto.categories);
    }
    if (dto.qualityScore !== undefined) {
      nextEval.qualityScore = dto.qualityScore;
    }
    if (dto.academicScore !== undefined) {
      nextEval.academicScore = dto.academicScore;
    }
    if (dto.comprehensiveScore !== undefined) {
      nextEval.comprehensiveScore = dto.comprehensiveScore;
    }

    if (isStudentOperator && currentStatus === 'needs_revision') {
      const oldCategories = currentEval.categories ?? [];
      const newCategories = nextEval.categories ?? [];
      const nowIso = new Date().toISOString();
      nextEval.review = {
        status: 'pending',
        comment: currentEval.review?.comment,
        reviewedAt: nowIso,
        reviewedBy: currentEval.review?.reviewedBy,
      };
      const currentItemStatus = (existing[0].reviewItemStatus ??
        {}) as Record<string, ItemReviewState>;
      const allItemKeys = this.collectAllItemKeys(oldCategories);
      const newItemKeys = this.collectAllItemKeys(newCategories);
      const allKeys = Array.from(new Set([...allItemKeys, ...newItemKeys]));
      const nextItemStatus: Record<string, ItemReviewState> = {};
      const autoApprovedKeys: string[] = [];
      for (const itemKey of allKeys) {
        const state = currentItemStatus[itemKey];
        const changed = this.hasItemChanged(oldCategories, newCategories, itemKey);
        if (state?.status === 'needs_revision') {
          if (changed) {
            nextItemStatus[itemKey] = { status: 'pending' };
          } else {
            nextItemStatus[itemKey] = { status: 'needs_revision', comment: state.comment };
          }
        } else if (state?.status === 'approved') {
          nextItemStatus[itemKey] = state;
        } else {
          nextItemStatus[itemKey] = { status: 'approved', reviewedAt: nowIso, autoApproved: true };
          autoApprovedKeys.push(itemKey);
        }
      }
      patch.reviewItemStatus = nextItemStatus;
      patch.resubmitted = true;

      if (autoApprovedKeys.length > 0 && options?.operatorStudentId && options?.operatorRole) {
        this.safeLogOperation(
          options.operatorStudentId,
          options.operatorName || '',
          options.operatorRole,
          'resubmit_auto_approve',
          existing[0].studentId,
          dto.studentName ?? '',
          `重新提交后自动通过指标：${autoApprovedKeys.join(', ')}（共${autoApprovedKeys.length}项）`,
        );
      }
    }

    if (dto.categories !== undefined || dto.qualityScore !== undefined || dto.academicScore !== undefined || dto.comprehensiveScore !== undefined || isStudentOperator) {
      patch.evalData = nextEval;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    const updated = await this.db
      .update(qualityEvalRecords)
      .set(patch)
      .where(eq(qualityEvalRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(`更新素质评价记录: ${id}`);

    const record = this.mapToDto(updated[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        'update_eval',
        record.studentId,
        record.studentName,
        `修改素质评价，总分：${record.totalScore}`,
      );
    }

    return record;
  }

  async delete(
    id: string,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<void> {
    const deleted = await this.db
      .delete(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .returning({
        id: qualityEvalRecords.id,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
        totalScore: qualityEvalRecords.totalScore,
      });

    if (deleted.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(`删除素质评价记录: ${id}`);

    if (options?.operatorStudentId && options.operatorRole) {
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        'delete_eval',
        deleted[0].studentId,
        deleted[0].studentName ?? undefined,
        `删除素质评价记录`,
      );
    }
  }

  async batchDelete(
    ids: string[],
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<number> {
    const deleted = await this.db
      .delete(qualityEvalRecords)
      .where(inArray(qualityEvalRecords.id, ids))
      .returning({
        id: qualityEvalRecords.id,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
      });

    this.logger.log(`批量删除素质评价记录: ${deleted.length} 条`);

    if (options?.operatorStudentId && options.operatorRole) {
      for (const record of deleted) {
        this.safeLogOperation(
          options.operatorStudentId,
          options.operatorName || '',
          options.operatorRole,
          'delete_eval',
          record.studentId,
          record.studentName ?? undefined,
          `批量删除素质评价记录`,
        );
      }
    }

    return deleted.length;
  }

  async review(
    id: string,
    dto: ReviewQualityEvalDto,
    reviewerId?: string,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    const existing = await this.db
      .select({
        id: qualityEvalRecords.id,
        evalData: qualityEvalRecords.evalData,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
      })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    const currentEval = (existing[0].evalData ?? {}) as EvalDataJson;
    const nextEval: EvalDataJson = {
      ...currentEval,
      review: {
        status: dto.status,
        comment: dto.comment,
        reviewedAt: new Date().toISOString(),
        reviewedBy: reviewerId,
      },
    };

    const updateSet: Partial<QualityEvalInsert> = {
      evalData: nextEval,
      updatedAt: new Date(),
    };

    // 整体打回 needs_revision 状态时，重置学生本轮重新提交机会
    if (dto.status === 'needs_revision') {
      updateSet.resubmitted = false;
    }
    if (dto.status === 'approved') {
      const allItemKeys = this.collectAllItemKeys(currentEval.categories ?? []);
      const nowIso = new Date().toISOString();
      const allApproved: Record<string, ItemReviewState> = {};
      for (const itemKey of allItemKeys) {
        allApproved[itemKey] = {
          status: 'approved',
          comment: dto.comment,
          reviewerId,
          reviewedAt: nowIso,
        };
      }
      updateSet.reviewItemStatus = allApproved;
    }

    const updated = await this.db
      .update(qualityEvalRecords)
      .set(updateSet)
      .where(eq(qualityEvalRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(`审查素质评价记录 ${id}: ${dto.status}`);

    const record = this.mapToDto(updated[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      const opTypeMap: Record<string, string> = {
        approved: 'review_approve',
        rejected: 'review_reject',
        needs_revision: 'review_needs_revision',
      };
      const opType = opTypeMap[dto.status];
      if (opType) {
        this.safeLogOperation(
          options.operatorStudentId,
          options.operatorName || '',
          options.operatorRole,
          opType,
          record.studentId,
          record.studentName,
          `审查${dto.status === 'approved' ? '通过' : '标记待修改'}：${dto.comment || '无备注'}`,
        );
      }
    }

    return record;
  }

  private collectAllItemKeys(categories: EvalCategory[]): string[] {
    const keys: string[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        keys.push(item.itemKey);
      }
    }
    return keys;
  }

  private computeOverallReviewStatus(
    itemStatus: Record<string, ItemReviewState>,
    allItemKeys: string[],
  ): ReviewStatus {
    if (allItemKeys.length === 0) return 'pending';

    let hasNeedsRevision = false;
    let allApproved = true;

    for (const itemKey of allItemKeys) {
      const state = itemStatus[itemKey];
      if (!state) {
        allApproved = false;
        continue;
      }
      if (state.status === 'needs_revision') {
        hasNeedsRevision = true;
        allApproved = false;
        break;
      }
      if (state.status !== 'approved') {
        allApproved = false;
      }
    }

    if (hasNeedsRevision) return 'needs_revision';
    if (allApproved) return 'approved';
    return 'pending';
  }

  async reviewItem(
    id: string,
    dto: ReviewItemDto,
    reviewerId?: string,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    const existing = await this.db
      .select({
        id: qualityEvalRecords.id,
        evalData: qualityEvalRecords.evalData,
        reviewItemStatus: qualityEvalRecords.reviewItemStatus,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
      })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    const currentItemStatus = (existing[0].reviewItemStatus ??
      {}) as Record<string, ItemReviewState>;
    const currentEval = (existing[0].evalData ?? {}) as EvalDataJson;
    const nowIso = new Date().toISOString();

    const nextItemStatus: Record<string, ItemReviewState> = {
      ...currentItemStatus,
      [dto.itemKey]: {
        status: dto.status,
        comment: dto.comment,
        reviewerId,
        reviewedAt: nowIso,
      },
    };

    // 标记待修改时不改变整体记录状态，只有点击"打回"才会改变整体状态
    // 标记通过时，如果所有指标都通过了，整体状态变为 approved
    let nextEval: EvalDataJson;
    let updateSet: Partial<QualityEvalInsert>;

    if (dto.status === 'needs_revision') {
      // 标记待修改：只更新单个指标状态，不改变整体状态
      nextEval = {
        ...currentEval,
        review: {
          status: currentEval.review?.status ?? 'pending',
          comment: currentEval.review?.comment,
          reviewedAt: currentEval.review?.reviewedAt,
          reviewedBy: currentEval.review?.reviewedBy,
        },
      };
      updateSet = {
        reviewItemStatus: nextItemStatus,
        evalData: nextEval,
        updatedAt: new Date(),
      };
    } else {
      // 标记通过或其他状态：重新计算整体状态
      const allItemKeys = this.collectAllItemKeys(
        currentEval.categories ?? [],
      );
      const overallStatus = this.computeOverallReviewStatus(
        nextItemStatus,
        allItemKeys,
      );

      nextEval = {
        ...currentEval,
        review: {
          status: overallStatus,
          comment: currentEval.review?.comment,
          reviewedAt: nowIso,
          reviewedBy: reviewerId,
        },
      };

      updateSet = {
        reviewItemStatus: nextItemStatus,
        evalData: nextEval,
        updatedAt: new Date(),
      };

      if (overallStatus === 'needs_revision') {
        updateSet.resubmitted = false;
      }
    }

    const updated = await this.db
      .update(qualityEvalRecords)
      .set(updateSet)
      .where(eq(qualityEvalRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(
      `逐指标审查 ${id} / ${dto.itemKey}: ${dto.status}`,
    );

    const record = this.mapToDto(updated[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      const opTypeMap: Record<string, string> = {
        approved: 'review_item_approve',
        needs_revision: 'review_item_needs_revision',
        pending: 'review_item_pending',
      };
      const opType = opTypeMap[dto.status] ?? 'review_item';
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        opType,
        record.studentId,
        record.studentName,
        `指标 ${dto.itemKey} 审查${dto.status === 'approved' ? '通过' : dto.status === 'needs_revision' ? '需修改' : '待审'}：${dto.comment || '无备注'}`,
      );
    }

    return record;
  }

  async reviewAllItems(
    id: string,
    reviewerId?: string,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    const existing = await this.db
      .select({
        id: qualityEvalRecords.id,
        evalData: qualityEvalRecords.evalData,
        reviewItemStatus: qualityEvalRecords.reviewItemStatus,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
      })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    const currentEval = (existing[0].evalData ?? {}) as EvalDataJson;
    const allItemKeys = this.collectAllItemKeys(
      currentEval.categories ?? [],
    );
    const nowIso = new Date().toISOString();

    const nextItemStatus: Record<string, ItemReviewState> = {};
    for (const itemKey of allItemKeys) {
      nextItemStatus[itemKey] = {
        status: 'approved',
        reviewerId,
        reviewedAt: nowIso,
      };
    }

    const nextEval: EvalDataJson = {
      ...currentEval,
      review: {
        status: 'pending',
        comment: currentEval.review?.comment,
        reviewedAt: nowIso,
        reviewedBy: reviewerId,
      },
    };

    const updated = await this.db
      .update(qualityEvalRecords)
      .set({
        reviewItemStatus: nextItemStatus,
        evalData: nextEval,
        updatedAt: new Date(),
      })
      .where(eq(qualityEvalRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(`一键确认所有指标 ${id}`);

    const record = this.mapToDto(updated[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        'review_all_items_approve',
        record.studentId,
        record.studentName,
        `一键确认所有指标（共${allItemKeys.length}项）`,
      );
    }

    return record;
  }

  /** @deprecated 智能核对功能已废弃，返回空结果 */
  async smartCheck(_id: string): Promise<ReviewCheckSummary> {
    return {
      total: 0,
      pass: 0,
      warning: 0,
      error: 0,
      results: [],
    };
  }

  async exportAll(params: {
    studentId?: string;
    studentName?: string;
    className?: string;
    reviewStatus?: ReviewStatus | 'returned';
    ids?: string[];
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    studentIds?: string[];
    studentNames?: string[];
    classNames?: string[];
    reviewStatuses?: string[];
  }): Promise<QualityEvalRecord[]> {
    const {
      studentId,
      studentName,
      ids,
      className: classFilter,
      reviewStatus: statusFilter,
      sortField,
      sortOrder,
      studentIds,
      studentNames,
      classNames,
      reviewStatuses,
    } = params;

    const conditions = [];
    if (ids && ids.length > 0) {
      conditions.push(inArray(qualityEvalRecords.id, ids));
    }
    if (studentId) {
      conditions.push(ilike(qualityEvalRecords.studentId, `%${studentId}%`));
    }
    if (studentName) {
      conditions.push(ilike(qualityEvalRecords.studentName, `%${studentName}%`));
    }
    if (classFilter) {
      conditions.push(ilike(qualityEvalRecords.className, `%${classFilter}%`));
    }
    if (studentIds && studentIds.length > 0) {
      conditions.push(inArray(qualityEvalRecords.studentId, studentIds));
    }
    if (studentNames && studentNames.length > 0) {
      conditions.push(inArray(qualityEvalRecords.studentName, studentNames));
    }
    if (classNames && classNames.length > 0) {
      conditions.push(inArray(qualityEvalRecords.className, classNames));
    }
    const statusExpr = sql`(${qualityEvalRecords.evalData}->'review'->>'status')::text`;
    if (statusFilter) {
      if (statusFilter === 'returned') {
        conditions.push(
          sql`(${statusExpr} = ${'needs_revision'} OR ${statusExpr} = ${'rejected'})`,
        );
      } else {
        conditions.push(sql`${statusExpr} = ${statusFilter}`);
      }
    }
    if (reviewStatuses && reviewStatuses.length > 0) {
      conditions.push(
        sql`${statusExpr} = ANY(ARRAY[${sql.join(reviewStatuses.map((s: string) => sql`${s}`), sql`, `)}]::text[])`,
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    let orderExpr = desc(qualityEvalRecords.createdAt);
    if (sortField) {
      const isAsc = sortOrder === 'asc';
      switch (sortField) {
        case 'studentId':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.studentId)
            : desc(qualityEvalRecords.studentId);
          break;
        case 'studentName':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.studentName)
            : desc(qualityEvalRecords.studentName);
          break;
        case 'className':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.className)
            : desc(qualityEvalRecords.className);
          break;
        case 'totalScore':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.totalScore)
            : desc(qualityEvalRecords.totalScore);
          break;
        case 'reviewStatus':
          orderExpr = isAsc ? asc(statusExpr) : desc(statusExpr);
          break;
        case 'createdAt':
          orderExpr = isAsc
            ? asc(qualityEvalRecords.createdAt)
            : desc(qualityEvalRecords.createdAt);
          break;
        default:
          break;
      }
    }

    const rows = await this.db
      .select()
      .from(qualityEvalRecords)
      .where(whereClause)
      .orderBy(orderExpr);

    return rows.map((row: QualityEvalSelect) => this.mapToDto(row));
  }

  // ========== 填写时间设置 ==========

  private static readonly FILL_TIME_SETTING_KEY = 'fill_time';

  private static readonly DEFAULT_FILL_TIME_SETTINGS: FillTimeSettings = {
    mode: 'always',
    start: '',
    end: '',
  };

  async getFillTimeSettings(): Promise<FillTimeSettings> {
    const rows = await this.db
      .select()
      .from(qualityEvalSettings)
      .where(eq(qualityEvalSettings.settingKey, QualityEvalService.FILL_TIME_SETTING_KEY))
      .limit(1);

    if (rows.length === 0 || !rows[0].settingValue) {
      return QualityEvalService.DEFAULT_FILL_TIME_SETTINGS;
    }

    try {
      const parsed = JSON.parse(rows[0].settingValue) as FillTimeSettings;
      return {
        mode: parsed.mode === 'specified' ? 'specified' : 'always',
        start: parsed.start ?? '',
        end: parsed.end ?? '',
      };
    } catch {
      return QualityEvalService.DEFAULT_FILL_TIME_SETTINGS;
    }
  }

  async canStudentFillNow(): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getFillTimeSettings();
    if (settings.mode === 'always') {
      return { allowed: true };
    }
    if (!settings.start || !settings.end) {
      return { allowed: false, reason: '当前不在评价填写时间内' };
    }
    const now = new Date();
    const start = new Date(settings.start);
    const end = new Date(settings.end);
    if (now < start) {
      return { allowed: false, reason: `评价填写尚未开始，开始时间：${settings.start}` };
    }
    if (now > end) {
      return { allowed: false, reason: `评价填写已结束，结束时间：${settings.end}` };
    }
    return { allowed: true };
  }

  async updateFillTimeSettings(
    dto: FillTimeSettingsDto,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<FillTimeSettings> {
    const settings: FillTimeSettings = {
      mode: dto.mode === 'specified' ? 'specified' : 'always',
      start: dto.start ?? '',
      end: dto.end ?? '',
    };

    const valueStr = JSON.stringify(settings);

    // upsert：存在则更新，不存在则插入
    const existing = await this.db
      .select({ id: qualityEvalSettings.id })
      .from(qualityEvalSettings)
      .where(eq(qualityEvalSettings.settingKey, QualityEvalService.FILL_TIME_SETTING_KEY))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(qualityEvalSettings)
        .set({ settingValue: valueStr, updatedAt: new Date() })
        .where(eq(qualityEvalSettings.id, existing[0].id));
    } else {
      await this.db
        .insert(qualityEvalSettings)
        .values({
          settingKey: QualityEvalService.FILL_TIME_SETTING_KEY,
          settingValue: valueStr,
        });
    }

    this.logger.log('更新填写时间设置');

    if (options?.operatorStudentId && options.operatorRole) {
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        'update_fill_time_settings',
        undefined,
        undefined,
        `填写时间模式：${settings.mode}${settings.mode === 'specified' ? `，${settings.start} ~ ${settings.end}` : ''}`,
      );
    }

    return settings;
  }

  async reviewReason(
    id: string,
    dto: ReviewReasonDto,
    reviewerId?: string,
    options?: {
      operatorStudentId?: string;
      operatorName?: string;
      operatorRole?: string;
    },
  ): Promise<QualityEvalRecord> {
    const existing = await this.db
      .select({
        id: qualityEvalRecords.id,
        evalData: qualityEvalRecords.evalData,
        reviewItemStatus: qualityEvalRecords.reviewItemStatus,
        reviewReasonStatus: qualityEvalRecords.reviewReasonStatus,
        studentId: qualityEvalRecords.studentId,
        studentName: qualityEvalRecords.studentName,
      })
      .from(qualityEvalRecords)
      .where(eq(qualityEvalRecords.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    const currentReasonStatus = (existing[0].reviewReasonStatus ??
      {}) as Record<string, { status: ReasonReviewStatus; comment?: string; reviewerId?: string; reviewerName?: string; reviewedAt?: string }>;
    const nowIso = new Date().toISOString();

    const nextReasonStatus: Record<string, { status: ReasonReviewStatus; comment?: string; reviewerId?: string; reviewerName?: string; reviewedAt?: string }> = {
      ...currentReasonStatus,
      [dto.reasonId]: {
        status: dto.status,
        comment: dto.comment,
        reviewerId,
        reviewerName: options?.operatorName,
        reviewedAt: nowIso,
      },
    };

    // 重新计算指标级审查状态
    const currentEval = (existing[0].evalData ?? {}) as EvalDataJson;
    const currentItemStatus = (existing[0].reviewItemStatus ??
      {}) as Record<string, ItemReviewState>;
    const allItemKeys = this.collectAllItemKeys(currentEval.categories ?? []);
    const nextItemStatus = this.computeItemStatusFromReasons(
      currentEval.categories ?? [],
      nextReasonStatus,
      currentItemStatus,
      allItemKeys,
      nowIso,
      reviewerId,
    );

    // 标记原因级待修改时不改变整体记录状态，只有点击"打回"才会改变整体状态
    let nextEval: EvalDataJson;
    let updateSet: Partial<QualityEvalInsert>;

    if (dto.status === 'needs_revision') {
      // 标记原因级待修改：只更新原因状态和指标状态，不改变整体状态
      nextEval = {
        ...currentEval,
        review: {
          status: currentEval.review?.status ?? 'pending',
          comment: currentEval.review?.comment,
          reviewedAt: currentEval.review?.reviewedAt,
          reviewedBy: currentEval.review?.reviewedBy,
        },
      };
      updateSet = {
        reviewReasonStatus: nextReasonStatus,
        reviewItemStatus: nextItemStatus,
        evalData: nextEval,
        updatedAt: new Date(),
      };
    } else {
      // 标记通过或其他状态：重新计算整体状态
      const overallStatus = this.computeOverallReviewStatus(
        nextItemStatus,
        allItemKeys,
      );

      nextEval = {
        ...currentEval,
        review: {
          status: overallStatus,
          comment: currentEval.review?.comment,
          reviewedAt: nowIso,
          reviewedBy: reviewerId,
        },
      };

      updateSet = {
        reviewReasonStatus: nextReasonStatus,
        reviewItemStatus: nextItemStatus,
        evalData: nextEval,
        updatedAt: new Date(),
      };

      if (overallStatus === 'needs_revision') {
        updateSet.resubmitted = false;
      }
    }

    const updated = await this.db
      .update(qualityEvalRecords)
      .set(updateSet)
      .where(eq(qualityEvalRecords.id, id))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('评价记录不存在');
    }

    this.logger.log(
      `原因级审查 ${id} / ${dto.reasonId}: ${dto.status}`,
    );

    const record = this.mapToDto(updated[0]);

    if (options?.operatorStudentId && options.operatorRole) {
      const opTypeMap: Record<string, string> = {
        approved: 'review_reason_approve',
        needs_revision: 'review_reason_needs_revision',
        pending: 'review_reason_pending',
      };
      const opType = opTypeMap[dto.status] ?? 'review_reason';
      this.safeLogOperation(
        options.operatorStudentId,
        options.operatorName || '',
        options.operatorRole,
        opType,
        record.studentId,
        record.studentName,
        `原因 ${dto.reasonId} 审查${dto.status === 'approved' ? '通过' : dto.status === 'needs_revision' ? '需修改' : '待审'}：${dto.comment || '无备注'}`,
      );
    }

    return record;
  }

  private computeItemStatusFromReasons(
    categories: EvalCategory[],
    reasonStatus: Record<string, { status: ReasonReviewStatus; comment?: string; reviewerId?: string; reviewerName?: string; reviewedAt?: string }>,
    currentItemStatus: Record<string, ItemReviewState>,
    allItemKeys: string[],
    nowIso: string,
    reviewerId?: string,
  ): Record<string, ItemReviewState> {
    const next: Record<string, ItemReviewState> = { ...currentItemStatus };
    for (const itemKey of allItemKeys) {
      const reasonsForItem = this.collectReasonsForItem(categories, itemKey);
      if (reasonsForItem.length === 0) {
        next[itemKey] = { status: 'approved', reviewerId, reviewedAt: nowIso };
        continue;
      }
      let hasNeedsRevision = false;
      let allReasonApproved = true;
      for (const reason of reasonsForItem) {
        const rs = reasonStatus[reason.id];
        if (rs?.status === 'needs_revision') {
          hasNeedsRevision = true;
          allReasonApproved = false;
          break;
        }
        if (rs?.status !== 'approved') {
          allReasonApproved = false;
        }
      }
      if (hasNeedsRevision) {
        next[itemKey] = { status: 'needs_revision', comment: currentItemStatus[itemKey]?.comment, reviewerId, reviewedAt: nowIso };
      } else if (allReasonApproved) {
        next[itemKey] = { status: 'approved', reviewerId, reviewedAt: nowIso };
      } else {
        next[itemKey] = currentItemStatus[itemKey] ?? { status: 'pending' };
      }
    }
    return next;
  }

  private collectReasonsForItem(
    categories: EvalCategory[],
    itemKey: string,
  ): EvalReason[] {
    for (const cat of categories) {
      for (const item of cat.items) {
        if (item.itemKey === itemKey) {
          return item.reasons || [];
        }
      }
    }
    return [];
  }

  async isFillTimeAllowed(): Promise<boolean> {
    const settings = await this.getFillTimeSettings();

    if (settings.mode === 'always') {
      return true;
    }

    if (!settings.start || !settings.end) {
      return true;
    }

    const now = new Date();
    const startDate = new Date(settings.start);
    const endDate = new Date(settings.end);

    return now >= startDate && now <= endDate;
  }
}
