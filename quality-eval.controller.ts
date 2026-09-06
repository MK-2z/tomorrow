import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Headers,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { QualityEvalService } from './quality-eval.service';
import type {
  CreateQualityEvalDto,
  UpdateQualityEvalDto,
  QualityEvalRecord,
  QualityEvalListResponse,
  ApiResponse,
  ReviewQualityEvalDto,
  ReviewCheckSummary,
  ReviewItemDto,
  ReviewReasonDto,
  FillTimeSettings,
   FillTimeSettingsDto,
   UserRole,
   ReviewStatus,
 } from '@shared/api.interface';

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];
const SUPER_ADMIN_ROLE: UserRole = 'super_admin';

function isAdminOrAbove(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

function isSuperAdmin(role: string): boolean {
  return role === SUPER_ADMIN_ROLE;
}

function isStudent(role: string): boolean {
  return role === 'student';
}

@Controller('api/quality-eval')
export class QualityEvalController {
  constructor(
    private readonly qualityEvalService: QualityEvalService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateQualityEvalDto,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    // 纯管理员（非学生身份）不能创建评价记录；学生管理员（admin+有学号）允许创建自己的记录
    if (operatorRole === 'admin' && !operatorStudentId) {
      throw new ForbiddenException('管理员无权限创建评价记录');
    }
    // 学生 / 学生管理员只能创建自己的记录
    const isStudentOperator = isStudent(operatorRole ?? '') || (operatorRole === 'admin' && Boolean(operatorStudentId));
    if (isStudentOperator && dto.studentId !== operatorStudentId) {
      throw new ForbiddenException('学生只能提交自己的评价记录');
    }

    if (isStudentOperator) {
      const canFill = await this.qualityEvalService.canStudentFillNow();
      if (!canFill.allowed) {
        throw new ForbiddenException(canFill.reason ?? '当前不在评价填写时间内');
      }
    }

    const data = await this.qualityEvalService.create(dto, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

   @Get()
   async list(
     @Query('page') page?: string,
     @Query('pageSize') pageSize?: string,
     @Query('keyword') keyword?: string,
     @Query('studentId') studentId?: string,
     @Query('studentName') studentName?: string,
     @Query('className') className?: string,
     @Query('reviewStatus') reviewStatus?: string,
     @Query('sortField') sortField?: string,
     @Query('sortOrder') sortOrder?: string,
     @Query('studentIds') studentIdsRaw?: string | string[],
     @Query('studentNames') studentNamesRaw?: string | string[],
     @Query('classNames') classNamesRaw?: string | string[],
     @Query('reviewStatuses') reviewStatusesRaw?: string | string[],
     @Headers('x-student-id') operatorStudentId?: string,
     @Headers('x-user-role') operatorRole?: string,
   ): Promise<ApiResponse<QualityEvalListResponse>> {
     const pageNum = page ? parseInt(page, 10) : 1;
     const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

     function parseArray(raw: string | string[] | undefined): string[] | undefined {
       if (raw === undefined) return undefined;
       const arr = Array.isArray(raw) ? raw : raw.split(',').filter(Boolean);
       return arr.length > 0 ? arr : undefined;
     }

     const isStudentOperator = isStudent(operatorRole ?? '');
     const effectiveStudentId = isStudentOperator
       ? operatorStudentId ?? studentId
       : studentId;
     const effectiveStudentName = isStudentOperator ? undefined : studentName;
     const effectiveClassName = isStudentOperator ? undefined : className;
     const effectiveSortOrder = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined;
     const effectiveStudentIds = isStudentOperator ? undefined : parseArray(studentIdsRaw);
     const effectiveStudentNames = isStudentOperator ? undefined : parseArray(studentNamesRaw);
     const effectiveClassNames = isStudentOperator ? undefined : parseArray(classNamesRaw);
     const effectiveReviewStatuses = parseArray(reviewStatusesRaw);
     void keyword;

     const data = await this.qualityEvalService.list({
       page: pageNum,
       pageSize: pageSizeNum,
       studentId: effectiveStudentId,
       studentName: effectiveStudentName,
       className: effectiveClassName,
       reviewStatus: reviewStatus as ReviewStatus | undefined,
       sortField,
       sortOrder: effectiveSortOrder,
       studentIds: effectiveStudentIds,
       studentNames: effectiveStudentNames,
       classNames: effectiveClassNames,
       reviewStatuses: effectiveReviewStatuses,
     });

     return { success: true, data, message: 'ok' };
   }

   @Get('column-values')
   async columnValues(
     @Query('field') field?: string,
     @Query('keyword') keyword?: string,
   ): Promise<ApiResponse<{ values: string[] }>> {
     if (!field) {
       throw new BadRequestException('field 参数不能为空');
     }
     const values = await this.qualityEvalService.getDistinctColumnValues(field, keyword || undefined);
     return { success: true, data: { values }, message: 'ok' };
   }

  @Get('export')
  async exportRecordsGet(
    @Query('studentId') studentId?: string,
    @Query('studentName') studentName?: string,
    @Query('className') className?: string,
    @Query('reviewStatus') reviewStatus?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord[]>> {
    if (!isSuperAdmin(operatorRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可导出数据');
    }

    const data = await this.qualityEvalService.exportAll({
      studentId,
      studentName,
      className,
      reviewStatus: reviewStatus as any,
    });
    return { success: true, data, message: 'ok' };
  }

  @Post('export')
  async exportRecordsPost(
    @Body() body: {
      studentId?: string;
      studentName?: string;
      className?: string;
      reviewStatus?: string;
      ids?: string[];
      sortField?: string;
      sortOrder?: 'asc' | 'desc';
      studentIds?: string[];
      studentNames?: string[];
      classNames?: string[];
      reviewStatuses?: string[];
    },
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord[]>> {
    if (!isSuperAdmin(operatorRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可导出数据');
    }

    const data = await this.qualityEvalService.exportAll({
      studentId: body.studentId,
      studentName: body.studentName,
      className: body.className,
      reviewStatus: body.reviewStatus as any,
      ids: body.ids,
      sortField: body.sortField,
      sortOrder: body.sortOrder,
      studentIds: body.studentIds,
      studentNames: body.studentNames,
      classNames: body.classNames,
      reviewStatuses: body.reviewStatuses,
    });
    return { success: true, data, message: 'ok' };
  }

  // ========== 填写时间设置（静态路由，必须在 :id 之前） ==========

  @Get('settings/fill-time')
  async getFillTimeSettings(
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<FillTimeSettings>> {
    // 所有登录用户可读
    if (!operatorRole) {
      throw new ForbiddenException('请先登录');
    }

    const data = await this.qualityEvalService.getFillTimeSettings();
    return { success: true, data, message: 'ok' };
  }

  @Put('settings/fill-time')
  async updateFillTimeSettings(
    @Body() dto: FillTimeSettingsDto,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<FillTimeSettings>> {
    if (!isSuperAdmin(operatorRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可修改填写时间设置');
    }

    if (dto.mode === 'specified' && (!dto.start || !dto.end)) {
      throw new BadRequestException('指定模式下开始和结束时间不能为空');
    }

    const data = await this.qualityEvalService.updateFillTimeSettings(dto, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  // ========== 单条记录操作（动态 :id 路由） ==========

  @Get(':id')
  async detail(
    @Param('id') id: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('无效的记录ID格式');
    }
    const data = await this.qualityEvalService.getById(id);
    return { success: true, data, message: 'ok' };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQualityEvalDto,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    const isSelf = Boolean(operatorStudentId);
    // 学生管理员打回自己后，重新提交走 PATCH 接口。此时 record 属于自己且状态为 needs_revision，应允许。
    // 管理员编辑他人记录仍然禁止（保留）。
    if (operatorRole === 'admin' && !isSelf) {
      throw new ForbiddenException('管理员无权限修改评价记录内容');
    }
    // 权限校验：学生/学生管理员只能修改自己的记录
    if (isStudent(operatorRole ?? '') || (operatorRole === 'admin' && isSelf)) {
      const record = await this.qualityEvalService.getById(id);
      if (record.studentId !== operatorStudentId) {
        throw new ForbiddenException('学生只能修改自己的评价记录');
      }
      if (dto.studentId && dto.studentId !== operatorStudentId) {
        throw new ForbiddenException('学生不能修改他人学号');
      }
      const canFill = await this.qualityEvalService.canStudentFillNow();
      if (!canFill.allowed) {
        // needs_revision 状态下重新提交不受填写时间限制
        if (record.reviewStatus !== 'needs_revision') {
          throw new ForbiddenException(canFill.reason ?? '当前不在评价填写时间内');
        }
      }
    }

    const data = await this.qualityEvalService.update(id, dto, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
  ): Promise<ApiResponse> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可删除评价记录');
    }

    await this.qualityEvalService.delete(id, {
      operatorStudentId,
      operatorName,
      operatorRole: realRole ?? '',
    });
    return { success: true, message: 'ok' };
  }

  @Post('batch-delete')
  async batchDelete(
    @Body() body: { ids: string[] },
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
  ): Promise<ApiResponse<{ deletedCount: number }>> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可删除评价记录');
    }
    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException('请选择要删除的记录');
    }

    const deletedCount = await this.qualityEvalService.batchDelete(body.ids, {
      operatorStudentId,
      operatorName,
      operatorRole: realRole ?? '',
    });
    return { success: true, data: { deletedCount }, message: 'ok' };
  }

  @Post(':id/review')
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewQualityEvalDto,
    @Req() req: any,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    if (!isAdminOrAbove(operatorRole ?? '')) {
      throw new ForbiddenException('无权限审查评价记录');
    }

    const userId = req.userContext?.userId;
    const data = await this.qualityEvalService.review(id, dto, userId, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  @Post(':id/review-item')
  async reviewItem(
    @Param('id') id: string,
    @Body() dto: ReviewItemDto,
    @Req() req: any,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    if (!isAdminOrAbove(operatorRole ?? '')) {
      throw new ForbiddenException('无权限审查评价指标');
    }

    if (!dto.itemKey) {
      throw new BadRequestException('指标 key 不能为空');
    }

    const userId = req.userContext?.userId;
    const data = await this.qualityEvalService.reviewItem(id, dto, userId, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  @Post(':id/review-reason')
  async reviewReason(
    @Param('id') id: string,
    @Body() dto: ReviewReasonDto,
    @Req() req: any,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    if (!isAdminOrAbove(operatorRole ?? '')) {
      throw new ForbiddenException('无权限审查评价原因');
    }

    if (!dto.reasonId || !dto.itemKey) {
      throw new BadRequestException('原因 ID 和指标 key 不能为空');
    }

    const userId = req.userContext?.userId;
    const data = await this.qualityEvalService.reviewReason(id, dto, userId, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  @Post(':id/review-all-items')
  async reviewAllItems(
    @Param('id') id: string,
    @Req() req: any,
    @Headers('x-student-id') operatorStudentId?: string,
    @Headers('x-user-name') operatorName?: string,
    @Headers('x-user-role') operatorRole?: string,
  ): Promise<ApiResponse<QualityEvalRecord>> {
    if (!isAdminOrAbove(operatorRole ?? '')) {
      throw new ForbiddenException('无权限审查评价指标');
    }

    const userId = req.userContext?.userId;
    const data = await this.qualityEvalService.reviewAllItems(id, userId, {
      operatorStudentId,
      operatorName,
      operatorRole,
    });
    return { success: true, data, message: 'ok' };
  }

  @Get(':id/smart-check')
  async smartCheck(
    @Param('id') id: string,
  ): Promise<ApiResponse<ReviewCheckSummary>> {
    const data = await this.qualityEvalService.smartCheck(id);
    return { success: true, data, message: 'ok' };
  }
}
