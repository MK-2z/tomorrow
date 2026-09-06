import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and, ilike, or, desc, count, gte, lt, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DRIZZLE_DATABASE } from '@server/database/database.module';
import { qualityEvalUsers, qualityEvalOperationLogs, qualityEvalRecords } from '@server/database/schema';
import type {
  QualityEvalUser,
  UserRole,
  UserListResponse,
  OperationLog,
  OperationLogListResponse,
} from '@shared/api.interface';

type QualityEvalUserSelect = typeof qualityEvalUsers.$inferSelect;
type QualityEvalOperationLogSelect = typeof qualityEvalOperationLogs.$inferSelect;

const VALID_ROLES: UserRole[] = ['student', 'admin', 'super_admin'];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private mapUserToDto(row: QualityEvalUserSelect): QualityEvalUser {
    return {
      id: row.id,
      studentId: row.studentId,
      role: row.role as UserRole,
      displayName: row.displayName ?? undefined,
      className: row.className ?? undefined,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      mustChangePassword: row.passwordHash === '123456',
    };
  }

  private mapLogToDto(row: QualityEvalOperationLogSelect): OperationLog {
    return {
      id: row.id,
      operatorStudentId: row.operatorStudentId,
      operatorName: row.operatorName ?? undefined,
      operatorRole: row.operatorRole as UserRole,
      operationType: row.operationType,
      targetStudentId: row.targetStudentId ?? undefined,
      targetStudentName: row.targetStudentName ?? undefined,
      detail: row.detail ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async login(
    studentId: string,
    password: string,
  ): Promise<QualityEvalUser | null> {
    if (!studentId || !password) {
      throw new BadRequestException('学号和密码不能为空');
    }

    const rows = await this.db
      .select()
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.studentId, studentId))
      .limit(1);

    // 用户不存在，自动注册学生账号
    if (rows.length === 0) {
      if (password !== '123456') {
        throw new UnauthorizedException('初始密码错误，请使用默认密码123456登录');
      }
      try {
        const newUser = await this.createUser({
          studentId,
          password,
          role: 'student',
        });
        this.logger.log(`自动注册学生账号: ${studentId}`);
        return newUser;
      } catch (err) {
        // 并发场景下可能已被插入，再查一次
        const retryRows = await this.db
          .select()
          .from(qualityEvalUsers)
          .where(eq(qualityEvalUsers.studentId, studentId))
          .limit(1);
        if (retryRows.length > 0 && retryRows[0].passwordHash === password) {
          return this.mapUserToDto(retryRows[0]);
        }
        throw err;
      }
    }

    const user = rows[0];
    if (!user.isActive) {
      throw new ForbiddenException('账号已被禁用');
    }

    if (user.passwordHash !== password) {
      if (user.role === 'student' && password === '123456') {
        await this.db
          .update(qualityEvalUsers)
          .set({ passwordHash: '123456', updatedAt: new Date() })
          .where(eq(qualityEvalUsers.id, user.id));
        this.logger.log(`学生账号 ${studentId} 使用初始密码登录，密码已重置为默认值`);
        return this.mapUserToDto({
          ...user,
          passwordHash: '123456',
          updatedAt: new Date(),
        });
      }
      return null;
    }

    return this.mapUserToDto(user);
  }

  async getUserById(id: string): Promise<QualityEvalUser> {
    const rows = await this.db
      .select()
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    return this.mapUserToDto(rows[0]);
  }

  async getOperatorRole(studentId: string | undefined): Promise<UserRole | null> {
    if (!studentId) return null;
    const rows = await this.db
      .select({ role: qualityEvalUsers.role })
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.studentId, studentId))
      .limit(1);
    if (rows.length === 0) return null;
    return rows[0].role as UserRole;
  }

  async updateStudentProfile(
    studentId: string,
    displayName: string,
    className: string,
  ): Promise<QualityEvalUser> {
    const updated = await this.db
      .update(qualityEvalUsers)
      .set({
        displayName,
        className,
        updatedAt: new Date(),
      })
      .where(eq(qualityEvalUsers.studentId, studentId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    this.logger.log(`更新学生档案: ${studentId}`);
    return this.mapUserToDto(updated[0]);
  }

  async listUsers(params: {
    page: number;
    pageSize: number;
    role?: string;
    keyword?: string;
  }): Promise<UserListResponse> {
    const { page, pageSize, role, keyword } = params;

    const conditions = [];
    if (role) {
      conditions.push(eq(qualityEvalUsers.role, role));
    }
    if (keyword) {
      conditions.push(
        or(
          ilike(qualityEvalUsers.studentId, `%${keyword}%`),
          ilike(qualityEvalUsers.displayName, `%${keyword}%`),
        ),
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(qualityEvalUsers)
        .where(whereClause)
        .orderBy(desc(qualityEvalUsers.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(qualityEvalUsers)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row: QualityEvalUserSelect) =>
      this.mapUserToDto(row),
    );

    return { items, total, page, pageSize };
  }

  async createUser(data: {
    studentId: string;
    password: string;
    role: UserRole;
    displayName?: string;
    className?: string;
  }): Promise<QualityEvalUser> {
    if (!data.studentId || !data.password) {
      throw new BadRequestException('学号和密码不能为空');
    }
    if (!VALID_ROLES.includes(data.role)) {
      throw new BadRequestException('无效的角色');
    }

    try {
      const result = await this.db
        .insert(qualityEvalUsers)
        .values({
          studentId: data.studentId,
          passwordHash: data.password,
          role: data.role,
          displayName: data.displayName || null,
          className: data.className || null,
        })
        .returning();

      if (!result || result.length === 0) {
        throw new BadRequestException('创建用户失败');
      }

      this.logger.log(`创建用户: ${data.studentId} (${data.role})`);
      return this.mapUserToDto(result[0]);
    } catch (err) {
      const code = this.extractPostgresErrorCode(err);
      if (code === '23505') {
        throw new ConflictException('该学号已存在');
      }
      throw err;
    }
  }

  async updateUserRole(userId: string, role: string): Promise<QualityEvalUser> {
    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new BadRequestException('无效的角色');
    }

    const updated = await this.db
      .update(qualityEvalUsers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(qualityEvalUsers.id, userId))
      .returning();

    if (updated.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    this.logger.log(`更新用户角色: ${userId} -> ${role}`);
    return this.mapUserToDto(updated[0]);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const rows = await this.db
      .select()
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const user = rows[0];
    if (user.passwordHash !== oldPassword) {
      throw new BadRequestException('旧密码错误');
    }

    await this.db
      .update(qualityEvalUsers)
      .set({
        passwordHash: newPassword,
        updatedAt: new Date(),
      })
      .where(eq(qualityEvalUsers.id, userId));

    this.logger.log(`用户修改密码: ${userId}`);
  }

  async resetPassword(userId: string): Promise<void> {
    const rows = await this.db
      .select()
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.id, userId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    await this.db
      .update(qualityEvalUsers)
      .set({
        passwordHash: '123456',
        updatedAt: new Date(),
      })
      .where(eq(qualityEvalUsers.id, userId));

    this.logger.log(`管理员重置用户密码: ${userId} -> 123456`);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.db
      .select({
        id: qualityEvalUsers.id,
        studentId: qualityEvalUsers.studentId,
        displayName: qualityEvalUsers.displayName,
      })
      .from(qualityEvalUsers)
      .where(eq(qualityEvalUsers.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new NotFoundException('用户不存在');
    }

    const studentId = user[0].studentId;

    await this.db.transaction(async (tx) => {
      await tx.delete(qualityEvalRecords).where(eq(qualityEvalRecords.studentId, studentId));
      await tx.delete(qualityEvalOperationLogs).where(
        or(
          eq(qualityEvalOperationLogs.targetStudentId, studentId),
          eq(qualityEvalOperationLogs.operatorStudentId, studentId),
        ),
      );
      await tx.delete(qualityEvalUsers).where(eq(qualityEvalUsers.id, userId));
    });

    this.logger.log(`删除用户: ${userId} (${studentId})`);
  }

  async batchDeleteUsers(userIds: string[]): Promise<{ deletedCount: number; skippedSuperAdmin: number }> {
    if (!userIds || userIds.length === 0) {
      return { deletedCount: 0, skippedSuperAdmin: 0 };
    }

    const users = await this.db
      .select({
        id: qualityEvalUsers.id,
        studentId: qualityEvalUsers.studentId,
        displayName: qualityEvalUsers.displayName,
        role: qualityEvalUsers.role,
      })
      .from(qualityEvalUsers)
      .where(inArray(qualityEvalUsers.id, userIds));

    if (users.length === 0) {
      return { deletedCount: 0, skippedSuperAdmin: 0 };
    }

    const deletable = users.filter((u: { role: string }) => u.role !== 'super_admin');
    const skippedSuperAdmin = users.length - deletable.length;

    if (deletable.length === 0) {
      return { deletedCount: 0, skippedSuperAdmin };
    }

    const studentIds = deletable.map((u: { studentId: string }) => u.studentId);
    const idsToDelete = deletable.map((u: { id: string }) => u.id);

    await this.db.transaction(async (tx) => {
      if (studentIds.length > 0) {
        await tx.delete(qualityEvalRecords).where(inArray(qualityEvalRecords.studentId, studentIds));
        await tx.delete(qualityEvalOperationLogs).where(
          or(
            inArray(qualityEvalOperationLogs.targetStudentId, studentIds),
            inArray(qualityEvalOperationLogs.operatorStudentId, studentIds),
          ),
        );
      }
      await tx.delete(qualityEvalUsers).where(inArray(qualityEvalUsers.id, idsToDelete));
    });

    this.logger.log(`批量删除用户: ${deletable.length} 人, 跳过超级管理员: ${skippedSuperAdmin} 人`);
    return { deletedCount: deletable.length, skippedSuperAdmin };
  }

  async getUsersByIds(ids: string[]): Promise<Array<{ id: string; studentId: string; displayName: string | null; role: string }>> {
    if (!ids || ids.length === 0) return [];
    const rows = await this.db
      .select({
        id: qualityEvalUsers.id,
        studentId: qualityEvalUsers.studentId,
        displayName: qualityEvalUsers.displayName,
        role: qualityEvalUsers.role,
      })
      .from(qualityEvalUsers)
      .where(inArray(qualityEvalUsers.id, ids));
    return rows as Array<{ id: string; studentId: string; displayName: string | null; role: string }>;
  }

  async logOperation(
    operatorStudentId: string,
    operatorName: string,
    operatorRole: string,
    operationType: string,
    targetStudentId?: string,
    targetStudentName?: string,
    detail?: string,
  ): Promise<void> {
    await this.db.insert(qualityEvalOperationLogs).values({
      operatorStudentId,
      operatorName: operatorName || null,
      operatorRole,
      operationType,
      targetStudentId: targetStudentId || null,
      targetStudentName: targetStudentName || null,
      detail: detail || null,
    });

    this.logger.log(
      `操作日志: ${operatorStudentId} - ${operationType}` +
        (targetStudentId ? ` -> ${targetStudentId}` : ''),
    );
  }

  async listLogs(params: {
    page: number;
    pageSize: number;
    operatorStudentId?: string;
    operationType?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<OperationLogListResponse> {
    const {
      page,
      pageSize,
      operatorStudentId: operatorId,
      operationType: opType,
      startTime,
      endTime,
    } = params;

    const conditions = [];
    if (operatorId) {
      conditions.push(
        ilike(qualityEvalOperationLogs.operatorStudentId, `%${operatorId}%`),
      );
    }
    if (opType) {
      conditions.push(eq(qualityEvalOperationLogs.operationType, opType));
    }
    if (startTime) {
      conditions.push(gte(qualityEvalOperationLogs.createdAt, new Date(startTime)));
    }
    if (endTime) {
      conditions.push(lt(qualityEvalOperationLogs.createdAt, new Date(endTime)));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(qualityEvalOperationLogs)
        .where(whereClause)
        .orderBy(desc(qualityEvalOperationLogs.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(qualityEvalOperationLogs)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((row: QualityEvalOperationLogSelect) =>
      this.mapLogToDto(row),
    );

    return { items, total, page, pageSize };
  }

  private extractPostgresErrorCode(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
      const { code, cause } = current as { code?: unknown; cause?: unknown };
      if (typeof code === 'string') return code;
      current = cause;
    }
    return undefined;
  }
}
