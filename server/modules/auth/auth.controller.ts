import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { NeedLogin } from '@server/common/decorators/need-login.decorator';
import { AuthService } from './auth.service';
import type {
  LoginRequest,
  LoginResponse,
  QualityEvalUser,
  UserListResponse,
  OperationLogListResponse,
  UserRole,
} from '@shared/api.interface';

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];
const SUPER_ADMIN_ROLE: UserRole = 'super_admin';

function isAdminOrAbove(role: string): boolean {
  return ADMIN_ROLES.includes(role as UserRole);
}

function isSuperAdmin(role: string): boolean {
  return role === SUPER_ADMIN_ROLE;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    const { studentId, password } = body;
    if (!studentId || !password) {
      throw new BadRequestException('学号和密码不能为空');
    }

    const user = await this.authService.login(studentId, password);
    if (!user) {
      throw new UnauthorizedException('学号或密码错误');
    }

    return {
      user,
      token: studentId,
    };
  }

  @NeedLogin()
  @Patch('profile')
  async updateProfile(
    @Headers('x-student-id') studentId: string,
    @Body() body: { displayName: string; className: string },
  ): Promise<QualityEvalUser> {
    if (!studentId) {
      throw new BadRequestException('学号不能为空');
    }
    if (body.displayName === undefined || body.className === undefined) {
      throw new BadRequestException('姓名和班级不能为空');
    }

    return this.authService.updateStudentProfile(
      studentId,
      body.displayName,
      body.className,
    );
  }

  @NeedLogin()
  @Patch('password')
  async changePassword(
    @Headers('x-student-id') studentId: string,
    @Body() body: { oldPassword: string; newPassword: string },
  ): Promise<{ success: boolean }> {
    if (!body.oldPassword || !body.newPassword) {
      throw new BadRequestException('旧密码和新密码不能为空');
    }
    if (body.newPassword.length < 6) {
      throw new BadRequestException('新密码至少6位');
    }

    const user = await this.authService.login(studentId, body.oldPassword);
    if (!user) {
      throw new BadRequestException('旧密码错误');
    }

    await this.authService.changePassword(user.id, body.oldPassword, body.newPassword);

    return { success: true };
  }

  @NeedLogin()
  @Get('users')
  async listUsers(
    @Headers('x-student-id') studentId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('role') role?: string,
    @Query('keyword') keyword?: string,
  ): Promise<UserListResponse> {
    const realRole = await this.authService.getOperatorRole(studentId);
    if (!realRole || !isAdminOrAbove(realRole)) {
      throw new ForbiddenException('无权限访问');
    }

    const pageNum = parseInt(page, 10) || 1;
    const pageSizeNum = parseInt(pageSize, 10) || 10;

    return this.authService.listUsers({
      page: pageNum,
      pageSize: pageSizeNum,
      role,
      keyword,
    });
  }

  @NeedLogin()
  @Post('users')
  async createUser(
    @Headers('x-student-id') operatorStudentId: string,
    @Body()
    body: {
      studentId: string;
      password: string;
      role: UserRole;
      displayName?: string;
      className?: string;
    },
  ): Promise<QualityEvalUser> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可创建用户');
    }

    const user = await this.authService.createUser({
      studentId: body.studentId,
      password: body.password,
      role: body.role,
      displayName: body.displayName,
      className: body.className,
    });

    this.authService.logOperation(
      operatorStudentId || 'system',
      '',
      realRole,
      'user_create',
      body.studentId,
      body.displayName,
      `创建用户: ${body.studentId} (${body.role})`,
    ).catch(() => {});

    return user;
  }

  @NeedLogin()
  @Patch('users/:id/role')
  async updateUserRole(
    @Headers('x-student-id') operatorStudentId: string,
    @Param('id') id: string,
    @Body() body: { role: UserRole },
  ): Promise<QualityEvalUser> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可修改用户角色');
    }

    const user = await this.authService.updateUserRole(id, body.role);

    this.authService.logOperation(
      operatorStudentId || 'system',
      '',
      realRole,
      'role_change',
      user.studentId,
      user.displayName,
      `角色变更为: ${body.role}`,
    ).catch(() => {});

    return user;
  }

  @NeedLogin()
  @Delete('users/:id')
  async deleteUser(
    @Headers('x-student-id') operatorStudentId: string,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可删除用户');
    }

    let targetStudentId = '';
    let targetStudentName = '';
    try {
      const user = await this.authService.getUserById(id);
      targetStudentId = user.studentId;
      targetStudentName = user.displayName || '';
    } catch {
      // 忽略查询失败
    }

    await this.authService.deleteUser(id);

    this.authService.logOperation(
      operatorStudentId || 'system',
      '',
      realRole,
      'user_delete',
      targetStudentId,
      targetStudentName,
      `删除用户: ${targetStudentId}`,
    ).catch(() => {});

    return { success: true };
  }

  @NeedLogin()
  @Post('users/batch-delete')
  async batchDeleteUsers(
    @Headers('x-student-id') operatorStudentId: string,
    @Body() body: { ids: string[] },
  ): Promise<{ success: boolean; deletedCount: number; skippedSuperAdmin: number }> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('仅超级管理员可批量删除用户');
    }

    if (!body.ids || body.ids.length === 0) {
      throw new BadRequestException('请选择要删除的用户');
    }

    const users = await this.authService.getUsersByIds(body.ids);
    const targetSummary = users
      .filter((u: { role: string }) => u.role !== 'super_admin')
      .map((u: { studentId: string; displayName: string | null }) => `${u.studentId}${u.displayName ? `(${u.displayName})` : ''}`)
      .join(', ');

    const result = await this.authService.batchDeleteUsers(body.ids);

    this.authService.logOperation(
      operatorStudentId || 'system',
      '',
      realRole ?? '',
      'user_batch_delete',
      '',
      '',
      `批量删除用户 ${result.deletedCount} 人: ${targetSummary}`,
    ).catch(() => {});

    return { success: true, deletedCount: result.deletedCount, skippedSuperAdmin: result.skippedSuperAdmin };
  }

  @NeedLogin()
  @Get('logs')
  async listLogs(
    @Headers('x-student-id') operatorStudentId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('operatorStudentId') operatorStudentIdFilter?: string,
    @Query('operationType') operationType?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ): Promise<OperationLogListResponse> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('无权限查看操作日志');
    }

    const pageNum = parseInt(page, 10) || 1;
    const pageSizeNum = parseInt(pageSize, 10) || 10;

    return this.authService.listLogs({
      page: pageNum,
      pageSize: pageSizeNum,
      operatorStudentId: operatorStudentIdFilter,
      operationType,
      startTime,
      endTime,
    });
  }

  @NeedLogin()
  @Post('logs')
  async createLog(
    @Headers('x-student-id') operatorStudentId: string,
    @Body()
    body: {
      operatorStudentId: string;
      operatorName?: string;
      operatorRole: string;
      operationType: string;
      targetStudentId?: string;
      targetStudentName?: string;
      detail?: string;
    },
  ): Promise<{ success: boolean }> {
    const realRole = await this.authService.getOperatorRole(operatorStudentId);
    if (!isSuperAdmin(realRole ?? '')) {
      throw new ForbiddenException('无权限记录操作日志');
    }

    await this.authService.logOperation(
      body.operatorStudentId,
      body.operatorName || '',
      body.operatorRole,
      body.operationType,
      body.targetStudentId,
      body.targetStudentName,
      body.detail,
    );

    return { success: true };
  }
}
