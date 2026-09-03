import { axiosForBackend } from '@/utils/axios';
import { logger } from '@/utils/logger';
import type {
  LoginResponse,
  QualityEvalUser,
  UserListResponse,
  OperationLogListResponse,
  CreateUserDto,
  UserRole,
} from '@shared/api.interface';

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const userStr = localStorage.getItem('quality_eval_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.studentId) headers['x-student-id'] = user.studentId;
      if (user.role) headers['x-user-role'] = user.role;
      if (user.displayName) headers['x-user-name'] = user.displayName;
    }
    const token = localStorage.getItem('quality_eval_token');
    if (token) headers['x-auth-token'] = token;
  } catch {
    // ignore
  }
  return headers;
}

export async function login(
  studentId: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const res = await axiosForBackend.post<LoginResponse>(
      '/api/auth/login',
      { studentId, password },
      { headers: getAuthHeaders() },
    );
    if (!res.data || !res.data.user) {
      throw new Error('登录失败');
    }
    return res.data;
  } catch (error) {
    logger.error('登录失败', error);
    throw error;
  }
}

export async function listUsers(params: {
  page?: number;
  pageSize?: number;
  role?: string;
  keyword?: string;
}): Promise<UserListResponse> {
  try {
    const res = await axiosForBackend.get<UserListResponse>(
      '/api/auth/users',
      { params, headers: getAuthHeaders() },
    );
    if (!res.data || !res.data.items) {
      throw new Error('获取用户列表失败');
    }
    return res.data;
  } catch (error) {
    logger.error('获取用户列表失败', error);
    throw error;
  }
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<QualityEvalUser> {
  try {
    const res = await axiosForBackend.patch<QualityEvalUser>(
      `/api/auth/users/${id}/role`,
      { role },
      { headers: getAuthHeaders() },
    );
    if (!res.data) {
      throw new Error('更新角色失败');
    }
    return res.data;
  } catch (error) {
    logger.error('更新用户角色失败', error);
    throw error;
  }
}

export async function createUser(data: CreateUserDto): Promise<QualityEvalUser> {
  try {
    const res = await axiosForBackend.post<QualityEvalUser>(
      '/api/auth/users',
      data,
      { headers: getAuthHeaders() },
    );
    if (!res.data) {
      throw new Error('创建用户失败');
    }
    return res.data;
  } catch (error) {
    logger.error('创建用户失败', error);
    throw error;
  }
}

export async function updateProfile(
  displayName: string,
  className: string,
): Promise<QualityEvalUser> {
  try {
    const res = await axiosForBackend.patch<QualityEvalUser>(
      '/api/auth/profile',
      { displayName, className },
      { headers: getAuthHeaders() },
    );
    if (!res.data) {
      throw new Error('更新个人信息失败');
    }
    return res.data;
  } catch (error) {
    logger.error('更新个人信息失败', error);
    throw error;
  }
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  try {
    const res = await axiosForBackend.patch<{ success: boolean }>(
      '/api/auth/password',
      { oldPassword, newPassword },
      { headers: getAuthHeaders() },
    );
    if (!res.data) {
      throw new Error('修改密码失败');
    }
    return res.data;
  } catch (error) {
    logger.error('修改密码失败', error);
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    const res = await axiosForBackend.delete(`/api/auth/users/${id}`, {
      headers: getAuthHeaders(),
    });
    if (res.status !== 200 && res.status !== 204) {
      throw new Error('删除用户失败');
    }
  } catch (error) {
    logger.error('删除用户失败', error);
    throw error;
  }
}

export async function batchDeleteUsers(ids: string[]): Promise<{ deletedCount: number; skippedSuperAdmin: number }> {
  try {
    const res = await axiosForBackend.post<{ success: boolean; deletedCount: number; skippedSuperAdmin: number }>(
      '/api/auth/users/batch-delete',
      { ids },
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success) {
      throw new Error('批量删除失败');
    }
    return { deletedCount: res.data.deletedCount, skippedSuperAdmin: res.data.skippedSuperAdmin };
  } catch (error) {
    logger.error('批量删除用户失败', error);
    throw error;
  }
}

export async function listLogs(params: {
  page?: number;
  pageSize?: number;
  operationType?: string;
  operatorStudentId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<OperationLogListResponse> {
  try {
    const res = await axiosForBackend.get<OperationLogListResponse>(
      '/api/auth/logs',
      { params, headers: getAuthHeaders() },
    );
    if (!res.data || !res.data.items) {
      throw new Error('获取日志列表失败');
    }
    return res.data;
  } catch (error) {
    logger.error('获取操作日志失败', error);
    throw error;
  }
}
