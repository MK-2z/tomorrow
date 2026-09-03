import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  EyeIcon,
  MessageSquareWarning,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
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

import * as qualityEvalApi from '@client/src/api/quality-eval';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QualityEvalRecord, ReviewStatus, ItemReviewState } from '@shared/api.interface';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待审查' },
  { value: 'approved', label: '已通过' },
  { value: 'needs_revision', label: '待修改' },
];

const STATUS_LABEL_MAP: Record<ReviewStatus, string> = {
  pending: '待审查',
  approved: '已通过',
  rejected: '待修改',
  needs_revision: '待修改',
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

function countNeedsRevisionItems(
  record: QualityEvalRecord,
): number {
  if (!record.reviewItemStatus) return 0;
  let count = 0;
  for (const key of Object.keys(record.reviewItemStatus)) {
    const state: ItemReviewState = record.reviewItemStatus[key];
    if (state?.status === 'needs_revision') count += 1;
  }
  return count;
}

const QualityEvalListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isStudent = currentUser?.role === 'student';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const hasStudentIdentity = Boolean(currentUser?.studentId);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [searchStudentId, setSearchStudentId] = useState('');
  const [searchStudentName, setSearchStudentName] = useState('');
  const [searchStatus, setSearchStatus] = useState<ReviewStatus | 'all'>('all');

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<QualityEvalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRevisionId, setExpandedRevisionId] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await qualityEvalApi.getQualityEvalList({
        page,
        pageSize: PAGE_SIZE,
        studentId: hasStudentIdentity
          ? currentUser?.studentId
          : searchStudentId || undefined,
        studentName: hasStudentIdentity ? undefined : (searchStudentName || undefined),
      });
      let filtered = res.items;
      if (searchStatus !== 'all') {
        filtered = filtered.filter(
          (r: QualityEvalRecord) => r.reviewStatus === searchStatus,
        );
      }
      setItems(filtered);
      setTotal(filtered.length);
    } catch (error) {
      logger.error('获取素质评价列表失败', error);
      toast.error('获取列表失败，请稍后重试');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchStudentId, searchStudentName, searchStatus, hasStudentIdentity, currentUser]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = () => {
    if (!hasStudentIdentity) setSearchStudentId(studentId.trim());
    setSearchStudentName(studentName.trim());
    setSearchStatus(statusFilter);
    setPage(1);
  };

  const handleReset = () => {
    setStudentId('');
    setStudentName('');
    setStatusFilter('all');
    setSearchStudentId('');
    setSearchStudentName('');
    setSearchStatus('all');
    setPage(1);
  };

  const handleCreate = () => {
    navigate('/eval');
  };

  const handleView = (id: string) => {
    navigate(`/eval?id=${id}&mode=view`);
  };

  const handleEdit = (id: string) => {
    navigate(`/eval?id=${id}`);
  };

  const toggleRevisionExpand = (id: string): void => {
    setExpandedRevisionId((prev) => (prev === id ? null : id));
  };

  const getRevisionItems = (record: QualityEvalRecord): { itemKey: string; comment?: string }[] => {
    if (!record.reviewItemStatus) return [];
    const result: { itemKey: string; comment?: string }[] = [];
    for (const key of Object.keys(record.reviewItemStatus)) {
      const state: ItemReviewState = record.reviewItemStatus[key];
      if (state?.status === 'needs_revision') {
        result.push({ itemKey: key, comment: state.comment });
      }
    }
    return result;
  };

  const getItemNameByKey = (record: QualityEvalRecord, itemKey: string): string => {
    for (const cat of record.categories) {
      const item = cat.items.find((i) => i.itemKey === itemKey);
      if (item) return item.itemName;
    }
    return itemKey;
  };

  const openDeleteDialog = (record: QualityEvalRecord) => {
    setDeletingId(record.id);
    setDeletingName(record.studentName);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteDialogOpen(false);
    setDeletingId(null);
    setDeletingName('');
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId || deleting) return;
    setDeleting(true);
    try {
      await qualityEvalApi.deleteQualityEval(deletingId);
      toast.success('删除成功');
      setDeleteDialogOpen(false);
      setDeletingId(null);
      setDeletingName('');
      // 当前页删除完且非第一页则回退一页
      if (items.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await fetchList();
      }
    } catch (error) {
      logger.error('删除素质评价记录失败', error);
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
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

  const renderStudentRecordCard = (record: QualityEvalRecord) => {
    const needsRevCount = countNeedsRevisionItems(record);
    const isExpanded = expandedRevisionId === record.id;
    const canEdit = record.reviewStatus === 'needs_revision' && !record.resubmitted;

    return (
      <div key={record.id} className="rounded-lg border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{record.studentName}</h3>
              <Badge variant={getStatusBadgeVariant(record.reviewStatus)}>
                {STATUS_LABEL_MAP[record.reviewStatus] ?? record.reviewStatus}
              </Badge>
              {record.resubmitted && record.reviewStatus === 'needs_revision' && (
                <Badge variant="destructive" className="text-xs">
                  最终打回
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>学号：{record.studentId}</span>
              <span>班级：{record.className}</span>
              <span>总分：{record.totalScore} 分</span>
              <span>提交时间：{new Date(record.createdAt).toLocaleString()}</span>
            </div>
            {needsRevCount > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => toggleRevisionExpand(record.id)}
                  className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 hover:underline"
                >
                  <MessageSquareWarning className="size-4" />
                  {needsRevCount} 个指标待修改
                  {isExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
              </div>
            )}
            {isExpanded && needsRevCount > 0 && (
              <div className="mt-2 rounded-md bg-amber-50/50 p-3 text-sm">
                <div className="mb-2 font-medium text-amber-800">
                  待修改指标明细：
                </div>
                <ul className="space-y-1">
                  {getRevisionItems(record).map((item) => (
                    <li key={item.itemKey} className="flex gap-2">
                      <span className="font-medium text-amber-700 min-w-12">
                        · {getItemNameByKey(record, item.itemKey)}：
                      </span>
                      <span className="text-muted-foreground">
                        {item.comment || '（无具体意见）'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {record.resubmitted && record.reviewStatus === 'needs_revision' && (
              <div className="text-sm text-destructive">
                您已使用过重新提交机会，如需修改请联系管理员
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleView(record.id)}>
              <EyeIcon className="size-4" />
              查看详情
            </Button>
            {canEdit && (
              <Button size="sm" onClick={() => handleEdit(record.id)}>
                修改并重新提交
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-xl">素质评价记录</CardTitle>
          {hasStudentIdentity && items.length === 0 && !loading && (
            <Button onClick={handleCreate}>
              <PlusIcon className="size-4" />
              新建评价
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 学生端视图：卡片列表展示自己的记录 */}
          {hasStudentIdentity ? (
            <>
              {loading && (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}
              {!loading && items.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>暂无评价记录</EmptyTitle>
                    <EmptyDescription>
                      您还没有提交过素质评价记录，点击右上角按钮创建第一条评价
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={handleCreate}>
                      <PlusIcon className="size-4" />
                      新建评价
                    </Button>
                  </EmptyContent>
                </Empty>
              )}
              {!loading && items.length > 0 && (
                <div className="space-y-3">
                  {items.map((record: QualityEvalRecord) => renderStudentRecordCard(record))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* 搜索栏 */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="student-id-input" className="w-12 text-sm text-muted-foreground">
                    学号
                  </label>
                  <Input
                    id="student-id-input"
                    placeholder="请输入学号"
                    value={studentId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentId(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="student-name-input" className="w-12 text-sm text-muted-foreground">
                    姓名
                  </label>
                  <Input
                    id="student-name-input"
                    placeholder="请输入姓名"
                    value={studentName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStudentName(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-12 text-sm text-muted-foreground">状态</label>
                  <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as ReviewStatus | 'all')}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" onClick={handleSearch}>
                    <SearchIcon className="size-4" />
                    搜索
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcwIcon className="size-4" />
                    重置
                  </Button>
                  <Button onClick={handleCreate}>
                    <PlusIcon className="size-4" />
                    新建评价
                  </Button>
                </div>
              </div>

              {/* 表格 */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>学号</TableHead>
                      <TableHead>班级</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>总分</TableHead>
                      <TableHead>审查状态</TableHead>
                      <TableHead>提交时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <>
                        {Array.from({ length: 5 }).map((_, idx: number) => (
                          <TableRow key={`skeleton-${idx}`}>
                            <TableCell colSpan={7}>
                              <Skeleton className="h-8 w-full" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                    {!loading && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <Empty className="border-0">
                            <EmptyHeader>
                              <EmptyTitle>暂无评价记录</EmptyTitle>
                              <EmptyDescription>
                                点击右上角"新建评价"创建第一条素质评价记录
                              </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                              <Button size="sm" onClick={handleCreate}>
                                <PlusIcon className="size-4" />
                                新建评价
                              </Button>
                            </EmptyContent>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading &&
                      items.map((record: QualityEvalRecord) => {
                        const needsRevCount = countNeedsRevisionItems(record);
                        const isExpanded = expandedRevisionId === record.id;
                        return (
                          <React.Fragment key={record.id}>
                            <TableRow>
                              <TableCell>{record.studentId}</TableCell>
                              <TableCell>{record.className}</TableCell>
                              <TableCell>{record.studentName}</TableCell>
                              <TableCell>{record.totalScore}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <Badge variant={getStatusBadgeVariant(record.reviewStatus)}>
                                    {STATUS_LABEL_MAP[record.reviewStatus] ?? record.reviewStatus}
                                  </Badge>
                                  {needsRevCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleRevisionExpand(record.id)}
                                      className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                                    >
                                      <MessageSquareWarning className="size-3" />
                                      {needsRevCount}个指标待修改
                                      {isExpanded ? (
                                        <ChevronUp className="size-3" />
                                      ) : (
                                        <ChevronDown className="size-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {new Date(record.createdAt).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleView(record.id)}
                                  >
                                    <EyeIcon className="size-4" />
                                    查看
                                  </Button>
                                  {isSuperAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => openDeleteDialog(record)}
                                    >
                                      <Trash2Icon className="size-4" />
                                      删除
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && needsRevCount > 0 && (
                              <TableRow className="bg-amber-50/50">
                                <TableCell colSpan={7} className="px-6 py-3">
                                  <div className="text-sm">
                                    <div className="mb-2 font-medium text-amber-800">
                                      待修改指标明细：
                                    </div>
                                    <ul className="space-y-1">
                                      {getRevisionItems(record).map((item) => (
                                        <li key={item.itemKey} className="flex gap-2">
                                          <span className="font-medium text-amber-700 min-w-12">
                                            · {getItemNameByKey(record, item.itemKey)}：
                                          </span>
                                          <span className="text-muted-foreground">
                                            {item.comment || '（无具体意见）'}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
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
                    {renderPageNumbers().map((pageNum: number) => (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          isActive={pageNum === page}
                          onClick={() => handlePageChange(pageNum)}
                          className="cursor-pointer"
                        >
                          {pageNum}
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
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除学生 <span className="font-medium text-foreground">{deletingName}</span>{' '}
              的素质评价记录吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QualityEvalListPage;
