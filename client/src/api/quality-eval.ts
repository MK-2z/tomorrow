import { axiosForBackend } from '@/utils/axios';
import { logger } from '@/utils/logger';
import {
  getAuthHeaders,
} from './auth';
import type {
  QualityEvalRecord,
  QualityEvalListResponse,
  CreateQualityEvalDto,
  UpdateQualityEvalDto,
  ApiResponse,
  ReviewQualityEvalDto,
  ReviewCheckSummary,
  ReviewItemDto,
  ReviewReasonDto,
  FillTimeSettings,
  FillTimeSettingsDto,
} from '@shared/api.interface';

export async function createQualityEval(dto: CreateQualityEvalDto): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord>>('/api/quality-eval', dto, {
      headers: getAuthHeaders(),
    });
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '创建失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('创建素质评价记录失败', error);
    throw error;
  }
}

export async function getQualityEvalList(params: {
  page?: number;
  pageSize?: number;
  studentId?: string;
  studentName?: string;
  className?: string;
  reviewStatus?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  studentIds?: string[];
  studentNames?: string[];
  classNames?: string[];
  reviewStatuses?: string[];
}): Promise<QualityEvalListResponse> {
  try {
    const res = await axiosForBackend.get<ApiResponse<QualityEvalListResponse>>('/api/quality-eval', {
      params,
      headers: getAuthHeaders(),
    });
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '获取列表失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('获取素质评价列表失败', error);
    throw error;
  }
}

export async function getColumnValues(field: string, keyword?: string): Promise<string[]> {
  try {
    const res = await axiosForBackend.get<ApiResponse<{ values: string[] }>>(
      '/api/quality-eval/column-values',
      {
        params: { field, keyword },
        headers: getAuthHeaders(),
      },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '获取列值失败');
    }
    return res.data.data.values;
  } catch (error) {
    logger.error('获取列可选值失败', error);
    throw error;
  }
}

export async function getQualityEvalDetail(id: string): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.get<ApiResponse<QualityEvalRecord>>(`/api/quality-eval/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '获取详情失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('获取素质评价详情失败', error);
    throw error;
  }
}

export async function updateQualityEval(
  id: string,
  dto: UpdateQualityEvalDto,
): Promise<QualityEvalRecord> {
  try {
      const res = await axiosForBackend.patch<ApiResponse<QualityEvalRecord>>(
        `/api/quality-eval/${id}`,
        dto,
        { headers: getAuthHeaders() },
      );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '更新失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('更新素质评价记录失败', error);
    throw error;
  }
}

export async function deleteQualityEval(id: string): Promise<void> {
  try {
    const res = await axiosForBackend.delete<ApiResponse>(`/api/quality-eval/${id}`, { headers: getAuthHeaders() });
    if (!res.data?.success) {
      throw new Error(res.data?.message || '删除失败');
    }
  } catch (error) {
    logger.error('删除素质评价记录失败', error);
    throw error;
  }
}

export async function batchDeleteQualityEval(ids: string[]): Promise<number> {
  try {
    const res = await axiosForBackend.post<ApiResponse<{ deletedCount: number }>>(
      '/api/quality-eval/batch-delete',
      { ids },
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success) {
      throw new Error(res.data?.message || '批量删除失败');
    }
    return res.data.data.deletedCount;
  } catch (error) {
    logger.error('批量删除素质评价记录失败', error);
    throw error;
  }
}

export async function exportQualityEval(params: {
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
}): Promise<QualityEvalRecord[]> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord[]>>(
      '/api/quality-eval/export',
      params,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '导出失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('导出素质评价记录失败', error);
    throw error;
  }
}

export async function reviewQualityEval(
  id: string,
  dto: ReviewQualityEvalDto,
): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord>>(
      `/api/quality-eval/${id}/review`,
      dto,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '审查操作失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('审查素质评价记录失败', error);
    throw error;
  }
}

export async function smartCheckQualityEval(
  id: string,
): Promise<ReviewCheckSummary> {
  try {
    const res = await axiosForBackend.get<ApiResponse<ReviewCheckSummary>>(
      `/api/quality-eval/${id}/smart-check`,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '智能核对失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('智能核对失败', error);
    throw error;
  }
}

export async function reviewItemQualityEval(
  id: string,
  dto: ReviewItemDto,
): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord>>(
      `/api/quality-eval/${id}/review-item`,
      dto,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '指标审查操作失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('指标审查操作失败', error);
    throw error;
  }
}

export async function reviewReasonQualityEval(
  id: string,
  dto: ReviewReasonDto,
): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord>>(
      `/api/quality-eval/${id}/review-reason`,
      dto,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '原因审查操作失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('原因审查操作失败', error);
    throw error;
  }
}

export async function reviewAllItemsQualityEval(
  id: string,
): Promise<QualityEvalRecord> {
  try {
    const res = await axiosForBackend.post<ApiResponse<QualityEvalRecord>>(
      `/api/quality-eval/${id}/review-all-items`,
      {},
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '一键确认失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('一键确认所有指标失败', error);
    throw error;
  }
}

export async function getFillTimeSettings(): Promise<FillTimeSettings> {
  try {
    const res = await axiosForBackend.get<ApiResponse<FillTimeSettings>>(
      '/api/quality-eval/settings/fill-time',
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '获取填写时间设置失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('获取填写时间设置失败', error);
    throw error;
  }
}

export async function updateFillTimeSettings(
  dto: FillTimeSettingsDto,
): Promise<FillTimeSettings> {
  try {
    const res = await axiosForBackend.put<ApiResponse<FillTimeSettings>>(
      '/api/quality-eval/settings/fill-time',
      dto,
      { headers: getAuthHeaders() },
    );
    if (!res.data?.success || !res.data.data) {
      throw new Error(res.data?.message || '更新填写时间设置失败');
    }
    return res.data.data;
  } catch (error) {
    logger.error('更新填写时间设置失败', error);
    throw error;
  }
}
