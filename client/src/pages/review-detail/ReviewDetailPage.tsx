import React from "react";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquareWarning,
  CheckCircle2 as CheckCircleIcon,
  Trash2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import * as qualityEvalApi from '@client/src/api/quality-eval';
import { updateQualityEval } from '@client/src/api/quality-eval';
import { useScoringRules } from '@client/src/hooks/useScoringRules';
import { normalizeEvalRecordScores } from '@client/src/pages/quality-eval/evalCategories';
import { ReasonCard } from '@client/src/pages/review-detail/ReasonCard';
import { useAuth } from '@client/src/contexts/AuthContext';
import { ScoringRulePanel } from '@client/src/pages/review-detail/ScoringRulePanel';
import {
  StudentInfoCard,
  ScoreSummaryCard,
} from '@client/src/pages/review-detail/StudentInfoCards';
import { ReviewActionsCard } from '@client/src/pages/review-detail/ReviewActionsCard';
import type {
  QualityEvalRecord,
  EvalCategory,
  EvalItem,
  EvalReason,
  ReviewStatus,
  ItemReviewStatus,
  ItemReviewState,
  ScoringRuleProject,
} from '@shared/api.interface';

function getStatusIcon(status: ReviewStatus) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'rejected':
      return <XCircle className="h-4 w-4" />;
    case 'needs_revision':
      return <MessageSquareWarning className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getItemReviewStatusLabel(status: ItemReviewStatus): string {
  switch (status) {
    case 'approved':
      return '已确认';
    case 'needs_revision':
       return '待修改';
    default:
      return '待确认';
  }
}

function getItemReviewStatusVariant(
  status: ItemReviewStatus,
): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'approved':
      return 'secondary';
    case 'needs_revision':
      return 'outline';
    default:
      return 'outline';
  }
}

const ReviewDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const { getPositiveProjects, getNegativeProjects } = useScoringRules();
  const { currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<QualityEvalRecord | null>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string>('');
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');

  // 待修改 dialog
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionItemKey, setRevisionItemKey] = useState<string>('');
  const [revisionItemName, setRevisionItemName] = useState<string>('');
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  // 删除 dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await qualityEvalApi.getQualityEvalDetail(id);
      setDetail(normalizeEvalRecordScores(data));
      for (const cat of data.categories) {
        for (const item of cat.items) {
          if (item.reasons.length > 0) {
            setSelectedItemKey(item.itemKey);
            setSelectedReasonId(item.reasons[0].id);
            return;
          }
        }
      }
    } catch (error) {
      logger.error('获取评价详情失败', error);
      toast.error('获取评价详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const positiveProjects = useMemo<ScoringRuleProject[]>(
    () => (selectedItemKey ? getPositiveProjects(selectedItemKey) : []),
    [selectedItemKey, getPositiveProjects],
  );

  const negativeProjects = useMemo<ScoringRuleProject[]>(
    () => (selectedItemKey ? getNegativeProjects(selectedItemKey) : []),
    [selectedItemKey, getNegativeProjects],
  );

  const selectedItemStats = useMemo(() => {
    if (!detail || !selectedItemKey) {
      return { maxScore: 0, earnedPositive: 0, remaining: 0 };
    }
    for (const cat of detail.categories) {
      const item: EvalItem | undefined = cat.items.find(
        (i: EvalItem) => i.itemKey === selectedItemKey,
      );
      if (item) {
        const maxScore = item.itemMaxScore ?? 0;
        const baseScore = (item.itemKey && {
          'law-abiding': 5,
          'physical-health': 5,
          'civilized': 5,
        }[item.itemKey]) || 0;
        let positive = baseScore;
        for (const r of item.reasons) {
          if (r.type === 'positive') positive += r.score;
        }
        return {
          maxScore,
          earnedPositive: Math.min(positive, maxScore),
          remaining: Math.max(0, maxScore - Math.min(positive, maxScore)),
        };
      }
    }
    return { maxScore: 0, earnedPositive: 0, remaining: 0 };
  }, [detail, selectedItemKey]);

  const selectedItemName = useMemo(() => {
    if (!detail || !selectedItemKey) return '';
    for (const cat of detail.categories) {
      const item = cat.items.find(
        (i: EvalItem) => i.itemKey === selectedItemKey,
      );
      if (item) return item.itemName;
    }
    return '';
  }, [detail, selectedItemKey]);

  // 审查进度统计
  const reviewProgress = useMemo(() => {
    if (!detail) return { total: 0, approved: 0, allConfirmed: false };
    let total = 0;
    let approved = 0;
    for (const cat of detail.categories) {
      for (const item of cat.items) {
        total += 1;
        const state = detail.reviewItemStatus[item.itemKey];
        if (state?.status === 'approved') approved += 1;
      }
    }
    return {
      total,
      approved,
      allConfirmed: total > 0 && approved === total,
    };
  }, [detail]);

  const handleSelectReason = (reason: EvalReason) => {
    setSelectedReasonId(reason.id);
    if (!detail) return;
    for (const cat of detail.categories) {
      for (const item of cat.items) {
        if (item.reasons.some((r: EvalReason) => r.id === reason.id)) {
          setSelectedItemKey(item.itemKey);
          return;
        }
      }
    }
  };

  const updateDetailCategories = (
    updater: (cats: EvalCategory[]) => EvalCategory[],
  ): void => {
    setDetail((prev) => {
      if (!prev) return prev;
      return { ...prev, categories: updater(prev.categories) };
    });
  };

  const handleEditReason = async (
    reasonId: string,
    score: number,
    reasonText: string,
    count?: number,
  ): Promise<void> => {
    if (!detail || !id) return;
    try {
      const updatedCats = detail.categories.map((cat: EvalCategory) => ({
        ...cat,
        items: cat.items.map((item: EvalItem) => ({
          ...item,
          reasons: item.reasons.map((r: EvalReason) =>
            r.id === reasonId ? { ...r, score, reason: reasonText, count } : r,
          ),
        })),
      }));
      const updated = await updateQualityEval(id, { categories: updatedCats });
      setDetail(normalizeEvalRecordScores(updated));
      toast.success('已更新评分项');
    } catch (error) {
      logger.error('编辑评分项失败', error);
      toast.error('操作失败，请稍后重试');
    }
  };

  const handleDeleteReason = async (reasonId: string): Promise<void> => {
    if (!detail || !id) return;
    try {
      const updatedCats = detail.categories.map((cat: EvalCategory) => ({
        ...cat,
        items: cat.items.map((item: EvalItem) => ({
          ...item,
          reasons: item.reasons.filter((r: EvalReason) => r.id !== reasonId),
        })),
      }));
      const updated = await updateQualityEval(id, { categories: updatedCats });
      setDetail(normalizeEvalRecordScores(updated));
      toast.success('已删除评分项');
      if (selectedReasonId === reasonId) {
        setSelectedReasonId('');
      }
    } catch (error) {
      logger.error('删除评分项失败', error);
      toast.error('操作失败，请稍后重试');
    }
  };

  const handleReview = async (status: ReviewStatus, comment?: string) => {
    if (!id) return;
    if (status === 'needs_revision' && !comment) {
      toast.warning('请填写打回意见');
      throw new Error('comment required');
    }
    const updated = await qualityEvalApi.reviewQualityEval(id, {
      status,
      comment,
    });
    setDetail(updated);
    toast.success(
      `已${status === 'approved' ? '通过' : '打回'}`,
    );
  };

  const handleApproveItem = async (itemKey: string) => {
    if (!id) return;
    try {
      const updated = await qualityEvalApi.reviewItemQualityEval(id, {
        itemKey,
        status: 'approved',
      });
      setDetail(updated);
      toast.success('已确认通过');
    } catch (error) {
      logger.error('确认通过失败', error);
      toast.error('操作失败，请稍后重试');
    }
  };

  const openRevisionDialog = (itemKey: string, itemName: string) => {
    setRevisionItemKey(itemKey);
    setRevisionItemName(itemName);
    setRevisionComment('');
    setRevisionDialogOpen(true);
  };

  const handleSubmitRevision = async () => {
    if (!id || !revisionItemKey) return;
    if (!revisionComment.trim()) {
      toast.warning('请填写批改意见');
      return;
    }
    setRevisionSubmitting(true);
    try {
      const updated = await qualityEvalApi.reviewItemQualityEval(id, {
        itemKey: revisionItemKey,
        status: 'needs_revision',
        comment: revisionComment.trim(),
      });
      setDetail(updated);
      setRevisionDialogOpen(false);
       toast.success('已标记待修改');
    } catch (error) {
       logger.error('标记待修改失败', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setRevisionSubmitting(false);
    }
  };

  const handleApproveAllItems = async () => {
    if (!id) return;
    setApprovingAll(true);
    try {
      const updated = await qualityEvalApi.reviewAllItemsQualityEval(id);
      setDetail(updated);
      toast.success('已确认所有指标');
    } catch (error) {
      logger.error('一键确认失败', error);
      toast.error('操作失败，请稍后重试');
    } finally {
      setApprovingAll(false);
    }
  };

  const getCurrentItemKeyForReason = (reasonId: string): string => {
    if (!detail) return '';
    for (const cat of detail.categories) {
      for (const item of cat.items) {
        if (item.reasons.some((r: EvalReason) => r.id === reasonId)) {
          return item.itemKey;
        }
      }
    }
    return '';
  };

  const handleMarkReasonNeedsRevision = async (
    reasonId: string,
    comment: string,
  ): Promise<void> => {
    if (!id) return;
    const itemKey = getCurrentItemKeyForReason(reasonId);
    if (!itemKey) throw new Error('未找到对应指标');
    const updated = await qualityEvalApi.reviewReasonQualityEval(id, {
      reasonId,
      itemKey,
      status: 'needs_revision',
      comment,
    });
    setDetail(updated);
  };

  const handleApproveReason = async (reasonId: string): Promise<void> => {
    if (!id) return;
    const itemKey = getCurrentItemKeyForReason(reasonId);
    if (!itemKey) throw new Error('未找到对应指标');
    const updated = await qualityEvalApi.reviewReasonQualityEval(id, {
      reasonId,
      itemKey,
      status: 'approved',
    });
    setDetail(updated);
  };

  const handlePendingReason = async (reasonId: string): Promise<void> => {
    if (!id) return;
    const itemKey = getCurrentItemKeyForReason(reasonId);
    if (!itemKey) throw new Error('未找到对应指标');
    const updated = await qualityEvalApi.reviewReasonQualityEval(id, {
      reasonId,
      itemKey,
      status: 'pending',
    });
    setDetail(updated);
  };

  const openDeleteDialog = () => {
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await qualityEvalApi.deleteQualityEval(id as string);
      toast.success('删除成功');
      navigate('/review');
    } catch (error: unknown) {
      logger.error('删除评价记录失败', error);
      const msg = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : '删除失败，请稍后重试';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const getItemReviewState = (itemKey: string): ItemReviewState | undefined => {
    if (!detail) return undefined;
    return detail.reviewItemStatus[itemKey];
  };

  const getItemStatus = (itemKey: string): ItemReviewStatus => {
    const state = getItemReviewState(itemKey);
    return state?.status ?? 'pending';
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[25%_50%_25%]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
          <Skeleton className="h-[600px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto w-full max-w-7xl p-6 text-center py-20">
        <p className="text-muted-foreground mb-4">未找到评价记录</p>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          className="-ml-2 text-muted-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
        {isSuperAdmin && detail && (
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={openDeleteDialog}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除记录
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[25%_50%_25%]">
        {/* 左栏 */}
        <div className="space-y-4">
          <StudentInfoCard
            detail={detail}
            statusIcon={getStatusIcon(detail.reviewStatus)}
          />
          <ReviewActionsCard
            onReview={handleReview}
            allItemsConfirmed={reviewProgress.allConfirmed}
            totalItems={reviewProgress.total}
            approvedItems={reviewProgress.approved}
          />
          {detail.reviewComment && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">审查意见</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {detail.reviewComment}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 中栏：原因列表 */}
        <div className="min-h-[600px]">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>评价明细</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    审查进度：{reviewProgress.approved}/{reviewProgress.total}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-emerald-400 text-emerald-700 hover:bg-emerald-50"
                    onClick={handleApproveAllItems}
                    disabled={approvingAll || reviewProgress.allConfirmed}
                  >
                    <CheckCircleIcon className="mr-1 h-3.5 w-3.5" />
                    {approvingAll ? '确认中...' : '一键确认所有指标'}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                共 {detail.categories.length} 个一级指标，点击条目查看评分标准
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[500px] px-6 pb-6">
                <div className="space-y-6">
                  {detail.categories.map((cat: EvalCategory) => (
                    <div key={cat.categoryKey}>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-base">
                          {cat.categoryName}
                          {cat.isExtra && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              附加
                            </Badge>
                          )}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          {cat.categoryScore}
                          {cat.categoryMaxScore !== undefined
                            ? ` / ${cat.categoryMaxScore}`
                            : ''}
                        </span>
                      </div>
                      <div className="space-y-4">
                         {cat.items.map((item: EvalItem) => {
                           const itemStatus = getItemStatus(item.itemKey);
                           const itemState = getItemReviewState(item.itemKey);
                           const isApproved = itemStatus === 'approved';
                           const isAutoApproved = isApproved && itemState?.autoApproved;
                           const isNeedsRevision = itemStatus === 'needs_revision';
                           const isUnmodifiedRevision = isNeedsRevision && detail.resubmitted;
                          return (
                            <div key={item.itemKey}>
                              <div
                                className={`mb-2 rounded-md px-3 py-2 cursor-pointer transition-colors ${
                                  selectedItemKey === item.itemKey
                                    ? 'bg-primary/10'
                                    : 'bg-muted/50 hover:bg-muted'
                                }`}
                                onClick={() => setSelectedItemKey(item.itemKey)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {item.itemName}
                                    </span>
                                     {isApproved && (
                                       <Badge
                                         variant="secondary"
                                         className={`text-xs border-0 ${isAutoApproved
                                           ? 'bg-sky-100 text-sky-700 hover:bg-sky-100'
                                           : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}`}
                                       >
                                         <CheckCircleIcon className="mr-1 h-3 w-3" />
                                         {isAutoApproved ? '自动通过' : getItemReviewStatusLabel(itemStatus)}
                                       </Badge>
                                     )}
                                     {isNeedsRevision && (
                                       <div className="flex flex-col gap-1">
                                         <Badge
                                           variant="outline"
                                           className="text-xs border-amber-300 text-amber-700 bg-amber-50"
                                         >
                                           <MessageSquareWarning className="mr-1 h-3 w-3" />
                                           {getItemReviewStatusLabel(itemStatus)}
                                         </Badge>
                                         {isUnmodifiedRevision && (
                                           <span className="text-[11px] text-amber-600 font-medium">
                                             该指标未修改，请关注
                                           </span>
                                         )}
                                       </div>
                                     )}
                                    {itemStatus === 'pending' && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs text-muted-foreground"
                                      >
                                        {getItemReviewStatusLabel(itemStatus)}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {item.itemScore}
                                    {item.itemMaxScore !== undefined
                                      ? ` / ${item.itemMaxScore}`
                                      : ''}
                                  </span>
                                </div>
                                {/* 操作按钮 */}
                                <div className="mt-2 flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      handleApproveItem(item.itemKey);
                                    }}
                                  >
                                    <CheckCircleIcon className="mr-1 h-3.5 w-3.5" />
                                    确认通过
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      openRevisionDialog(
                                        item.itemKey,
                                        item.itemName,
                                      );
                                    }}
                                  >
                                    <MessageSquareWarning className="mr-1 h-3.5 w-3.5" />
                                     标记待修改
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2 pl-3 border-l-2 border-muted">
                                {item.reasons.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2">
                                    暂无评分项
                                  </p>
                                ) : (
                                    item.reasons.map((reason: EvalReason) => (
                                      <ReasonCard
                                        key={reason.id}
                                        reason={reason}
                                        selected={selectedReasonId === reason.id}
                                        onSelect={handleSelectReason}
                                        canEdit={isSuperAdmin}
                                        onEdit={handleEditReason}
                                        onDelete={handleDeleteReason}
                                        isAdminReviewer={isSuperAdmin || currentUser?.role === 'admin'}
                                        onMarkNeedsRevision={handleMarkReasonNeedsRevision}
                                        onMarkApproved={handleApproveReason}
                                        onMarkPending={handlePendingReason}
                                      />
                                    ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* 右栏：评分标准对照 */}
        <div className="min-h-[400px]">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">评分标准对照</CardTitle>
              <CardDescription>
                {selectedItemName || '请选择二级指标'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {selectedItemKey ? (
                <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px] px-6 pb-6">
                  <ScoringRulePanel
                    maxScore={selectedItemStats.maxScore}
                    earnedPositive={selectedItemStats.earnedPositive}
                    remaining={selectedItemStats.remaining}
                    positiveProjects={positiveProjects}
                    negativeProjects={negativeProjects}
                  />
                </ScrollArea>
              ) : (
                <div className="px-6 py-12 text-center text-muted-foreground text-sm">
                  点击左侧评价项查看对应评分标准
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

       {/* 删除确认 Dialog */}
       <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>确认删除评价记录</DialogTitle>
             <DialogDescription>
               确定删除学生 {detail.studentName}（学号 {detail.studentId}）的素质评价记录吗？删除后不可恢复，学生将可以重新提交评价。
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button
               variant="outline"
               onClick={closeDeleteDialog}
               disabled={deleting}
             >
               取消
             </Button>
             <Button
               variant="destructive"
               onClick={handleDelete}
               disabled={deleting}
             >
               {deleting ? '删除中...' : '确认删除'}
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* 待修改意见 Dialog */}
       <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
             <DialogTitle>标记待修改</DialogTitle>
            <DialogDescription>
              请填写「{revisionItemName}」的批改意见，学生可根据意见修改后重新提交。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="请输入批改意见..."
              value={revisionComment}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRevisionComment(e.target.value)
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevisionDialogOpen(false)}
              disabled={revisionSubmitting}
            >
              取消
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSubmitRevision}
              disabled={revisionSubmitting || !revisionComment.trim()}
            >
              {revisionSubmitting ? '提交中...' : '确认提交'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewDetailPage;
