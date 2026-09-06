import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  Eye,
  FileSpreadsheet,
  FileArchive,
  Trash2,
  X,
  Clock,
  Check,
  MessageSquareWarning,
  LayoutGrid,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@client/src/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@client/src/components/ui/pagination';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { ColumnFilter, type SortOrder } from '@client/src/components/ui/column-filter/ColumnFilter';

import * as qualityEvalApi from '@client/src/api/quality-eval';
import { exportToExcel } from '@client/src/utils/export-excel';
import { exportProofFilesToZip } from '@client/src/utils/export-proof-zip';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QualityEvalRecord, ReviewStatus } from '@shared/api.interface';
import { showConfirm } from '@/compat';

const PAGE_SIZE = 10;

const STATUS_TABS: { value: ReviewStatus | 'all' | 'returned'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审查' },
  { value: 'approved', label: '已通过' },
  { value: 'returned', label: '打回' },
];

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: '待审查',
  approved: '已通过',
  rejected: '打回',
  needs_revision: '打回',
};

function getStatusBadgeVariant(
  status: ReviewStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'pending':
      return 'default';
    case 'approved':
      return 'secondary';
    case 'rejected':
      return 'destructive';
    case 'needs_revision':
      return 'outline';
    default:
      return 'default';
  }
}

type ColumnField =
  | 'studentId'
  | 'studentName'
  | 'className'
  | 'totalScore'
  | 'reviewStatus'
  | 'createdAt';

interface ListFilters {
  studentId: string[];
  studentName: string[];
  className: string[];
  reviewStatus: string[];
}

const ReviewListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [statusTab, setStatusTab] = useState<ReviewStatus | 'all' | 'returned'>('all');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<QualityEvalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ all: 0, pending: 0, approved: 0, returned: 0 });

  const [sortField, setSortField] = useState<ColumnField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [columnFilters, setColumnFilters] = useState<ListFilters>({
    studentId: [],
    studentName: [],
    className: [],
    reviewStatus: [],
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyColumnFilter = Object.values(columnFilters).some((arr: string[]) => arr.length > 0);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        pageSize: number;
        reviewStatus?: string;
        sortField?: string;
        sortOrder?: 'asc' | 'desc';
        studentIds?: string[];
        studentNames?: string[];
        classNames?: string[];
        reviewStatuses?: string[];
      } = {
        page,
        pageSize: PAGE_SIZE,
        reviewStatus: statusTab === 'all' ? undefined : statusTab,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
      };
      if (columnFilters.studentId.length > 0) params.studentIds = columnFilters.studentId;
      if (columnFilters.studentName.length > 0) params.studentNames = columnFilters.studentName;
      if (columnFilters.className.length > 0) params.classNames = columnFilters.className;
      if (columnFilters.reviewStatus.length > 0) params.reviewStatuses = columnFilters.reviewStatus;

      const res = await qualityEvalApi.getQualityEvalList(params);

      setItems(res.items);
      setTotal(res.total);
      if (res.stats) {
        setStats(res.stats);
      } else {
        setStats({ all: res.total, pending: 0, approved: 0, returned: 0 });
      }
      setSelectedIds(new Set());
    } catch (error) {
      logger.error('获取审查列表失败', error);
      toast.error('获取列表失败，请稍后重试');
      setItems([]);
      setTotal(0);
      setStats({ all: 0, pending: 0, approved: 0, returned: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, statusTab, sortField, sortOrder, columnFilters]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleStatusTabChange = (value: string) => {
    const v = value as ReviewStatus | 'all' | 'returned';
    setStatusTab(v);
    setPage(1);
  };

  const handleSortChange = (field: string, order: SortOrder) => {
    setSortField(order ? (field as ColumnField) : null);
    setSortOrder(order);
    setPage(1);
  };

  const handleColumnFilterChange = (field: string, values: string[]) => {
    setColumnFilters((prev: ListFilters) => ({
      ...prev,
      [field]: values,
    }));
    setPage(1);
  };

  const fetchColumnValues = useCallback(async (field: string, keyword: string): Promise<string[]> => {
    try {
      const values = await qualityEvalApi.getColumnValues(field, keyword || undefined);
      return values;
    } catch (error) {
      logger.error(`获取${field}列值失败`, error);
      return [];
    }
  }, []);

  const clearAllFilters = () => {
    setColumnFilters({
      studentId: [],
      studentName: [],
      className: [],
      reviewStatus: [],
    });
    setStatusTab('all');
    setSortField(null);
    setSortOrder(null);
    setPage(1);
  };

  const handleView = (id: string) => {
    navigate(`/review/detail?id=${id}`);
  };

  const handleExportAll = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const params: {
        reviewStatus?: string;
        sortField?: string;
        sortOrder?: 'asc' | 'desc';
        studentIds?: string[];
        studentNames?: string[];
        classNames?: string[];
        reviewStatuses?: string[];
      } = {
        reviewStatus: statusTab === 'all' ? undefined : statusTab,
        sortField: sortField ?? undefined,
        sortOrder: sortOrder ?? undefined,
      };
      if (columnFilters.studentId.length > 0) params.studentIds = columnFilters.studentId;
      if (columnFilters.studentName.length > 0) params.studentNames = columnFilters.studentName;
      if (columnFilters.className.length > 0) params.classNames = columnFilters.className;
      if (columnFilters.reviewStatus.length > 0) params.reviewStatuses = columnFilters.reviewStatus;

      const records = await qualityEvalApi.exportQualityEval(params);
      if (records.length === 0) {
        toast.info('暂无评价记录可导出');
        return;
      }
      exportToExcel(records);
      toast.success(`已导出 ${records.length} 条评价记录`);
    } catch (error) {
      logger.error('导出Excel失败', error);
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const handleExportSelected = async () => {
    if (exporting) return;
    if (selectedIds.size === 0) {
      toast.info('请先选择要导出的学生');
      return;
    }
    setExporting(true);
    try {
      const records = await qualityEvalApi.exportQualityEval({
        ids: Array.from(selectedIds),
      });
      if (records.length === 0) {
        toast.info('暂无评价记录可导出');
        return;
      }
      exportToExcel(records);
      toast.success(`已导出 ${records.length} 条评价记录`);
    } catch (error) {
      logger.error('导出选中Excel失败', error);
      toast.error('导出失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  const handleExportProofZip = async () => {
    if (exporting) return;
    if (selectedIds.size === 0) {
      toast.info('请先选择要导出证明材料的学生');
      return;
    }
    setExporting(true);
    try {
      const records = await qualityEvalApi.exportQualityEval({
        ids: Array.from(selectedIds),
      });
      if (records.length === 0) {
        toast.info('暂无评价记录可导出');
        return;
      }

      toast.info('正在打包证明材料，请稍候...（文件较多时可能需要较长时间）');
      await exportProofFilesToZip(records, { onlyWithProof: true });
      toast.success('证明材料导出完成');
    } catch (error) {
      logger.error('导出证明材料ZIP失败', error);
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '导出失败，请稍后重试';
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteOne = async (record: QualityEvalRecord) => {
    const confirmed = await showConfirm(`确定要删除 ${record.studentName}（${record.studentId}）的评价记录吗？\n\n删除后不可恢复，该学生将可以重新提交评价。`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await qualityEvalApi.deleteQualityEval(record.id);
      toast.success('删除成功');
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      fetchList();
    } catch (error: unknown) {
      logger.error('删除评价记录失败', error);
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '删除失败';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.info('请先选择要删除的记录');
      return;
    }
    const confirmed = await showConfirm(`确定要删除选中的 ${selectedIds.size} 条评价记录吗？\n\n删除后不可恢复，这些学生将可以重新提交评价。`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      const count = await qualityEvalApi.batchDeleteQualityEval(Array.from(selectedIds));
      toast.success(`已删除 ${count} 条评价记录`);
      setSelectedIds(new Set());
      fetchList();
    } catch (error: unknown) {
      logger.error('批量删除评价记录失败', error);
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '删除失败';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((r: QualityEvalRecord) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
  };

  const renderPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">审查工作台</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              对学生提交的素质评价记录进行审核
            </p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              {hasAnyColumnFilter && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="mr-1 h-4 w-4" />
                  清除筛选
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSelected}
                disabled={exporting || selectedIds.size === 0}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                导出评价记录
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                disabled={deleting || selectedIds.size === 0}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                删除选中
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportProofZip}
                disabled={exporting || selectedIds.size === 0}
              >
                <FileArchive className="mr-1 h-4 w-4" />
                导出证明材料
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 状态 Tab + 统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.value === 'all'
                  ? stats.all
                  : tab.value === 'pending'
                    ? stats.pending
                    : tab.value === 'approved'
                      ? stats.approved
                      : stats.returned;
              const active = statusTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleStatusTabChange(tab.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'hover:border-border/80 hover:bg-muted/30'}`}
                >
                  <div className="text-xs text-muted-foreground">{tab.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{count}</div>
                </button>
              );
            })}
          </div>

          {/* 表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isSuperAdmin && (
                    <TableHead className="w-12">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="flex h-4 w-4 items-center justify-center"
                        title={selectedIds.size === items.length && items.length > 0 ? '取消全选' : '全选当前页'}
                      >
                        <input
                          type="checkbox"
                          checked={items.length > 0 && selectedIds.size === items.length}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </button>
                    </TableHead>
                  )}
                  <TableHead className="w-36">
                    <ColumnFilter
                      title="学号"
                      field="studentId"
                      sortOrder={sortField === 'studentId' ? sortOrder : null}
                      selectedValues={columnFilters.studentId}
                      onSortChange={handleSortChange}
                      onFilterChange={handleColumnFilterChange}
                      fetchValues={fetchColumnValues}
                    />
                  </TableHead>
                  <TableHead className="w-28">
                    <ColumnFilter
                      title="姓名"
                      field="studentName"
                      sortOrder={sortField === 'studentName' ? sortOrder : null}
                      selectedValues={columnFilters.studentName}
                      onSortChange={handleSortChange}
                      onFilterChange={handleColumnFilterChange}
                      fetchValues={fetchColumnValues}
                    />
                  </TableHead>
                  <TableHead className="w-40">
                    <ColumnFilter
                      title="班级"
                      field="className"
                      sortOrder={sortField === 'className' ? sortOrder : null}
                      selectedValues={columnFilters.className}
                      onSortChange={handleSortChange}
                      onFilterChange={handleColumnFilterChange}
                      fetchValues={fetchColumnValues}
                    />
                  </TableHead>
                  <TableHead className="w-28">
                    <ColumnFilter
                      title="素质测评分数"
                      field="totalScore"
                      sortOrder={sortField === 'totalScore' ? sortOrder : null}
                      selectedValues={[]}
                      onSortChange={handleSortChange}
                      onFilterChange={() => {}}
                      fetchValues={async () => []}
                    />
                  </TableHead>
                  <TableHead className="w-28">
                    <ColumnFilter
                      title="审查状态"
                      field="reviewStatus"
                      sortOrder={sortField === 'reviewStatus' ? sortOrder : null}
                      selectedValues={columnFilters.reviewStatus}
                      onSortChange={handleSortChange}
                      onFilterChange={handleColumnFilterChange}
                      fetchValues={fetchColumnValues}
                      valueLabelMap={STATUS_LABEL_MAP}
                    />
                  </TableHead>
                  <TableHead className="w-40">
                    <ColumnFilter
                      title="提交时间"
                      field="createdAt"
                      sortOrder={sortField === 'createdAt' ? sortOrder : null}
                      selectedValues={[]}
                      onSortChange={handleSortChange}
                      onFilterChange={() => {}}
                      fetchValues={async () => []}
                    />
                  </TableHead>
                  <TableHead className="text-right w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <>
                    {Array.from({ length: 5 }).map((_, idx: number) => (
                      <TableRow key={`skeleton-${idx}`}>
                        <TableCell colSpan={isSuperAdmin ? 8 : 7}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {!loading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="p-0">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyTitle>暂无审查记录</EmptyTitle>
                          <EmptyDescription>
                            当前筛选条件下没有找到相关记录
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button size="sm" variant="outline" onClick={clearAllFilters}>
                            重置筛选
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  items.map((record: QualityEvalRecord) => (
                    <TableRow key={record.id}>
                      {isSuperAdmin && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleSelectOne(record.id)}
                            className="h-4 w-4 cursor-pointer accent-primary"
                          />
                        </TableCell>
                      )}
                      <TableCell>{record.studentId}</TableCell>
                      <TableCell>{record.studentName}</TableCell>
                      <TableCell>{record.className}</TableCell>
                      <TableCell>{record.qualityScore}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(record.reviewStatus)}>
                          {STATUS_LABEL_MAP[record.reviewStatus] ??
                            record.reviewStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.createdAt
                          ? new Date(record.createdAt).toLocaleString('zh-CN')
                          : '-'}
                      </TableCell>
                       <TableCell className="text-right w-36">
                         <div className="flex items-center justify-end gap-1">
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => handleView(record.id)}
                           >
                             <Eye className="size-4" />
                             查看
                           </Button>
                           {isSuperAdmin && (
                             <Button
                               variant="ghost"
                               size="sm"
                               className="text-destructive hover:text-destructive"
                               onClick={() => handleDeleteOne(record)}
                               disabled={deleting}
                             >
                               <Trash2 className="size-4" />
                               删除
                             </Button>
                           )}
                         </div>
                       </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {!loading && total > 0 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(page - 1)}
                    aria-disabled={page <= 1}
                    className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {renderPageNumbers().map((p: number) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === page}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(page + 1)}
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReviewListPage;
