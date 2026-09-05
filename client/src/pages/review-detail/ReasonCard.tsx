import React, { useState } from 'react';
import {
  AlertTriangle,
  HelpCircle,
  AlertTriangle,
  FileText,
  ZoomIn,
  Pencil,
  Trash2,
  MessageSquareWarning,
  Check as ApproveCircle,
  RotateCcw,
} from 'lucide-react';
import { showConfirm } from '@/compat';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Image } from '@/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { EvalReason, ProofFile, ReasonReviewStatus } from '@shared/api.interface';

const IMAGE_EXT_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function isImageFile(file: ProofFile): boolean {
  return IMAGE_EXT_REGEX.test(file.name || file.url);
}

export interface ReasonCardProps {
  reason: EvalReason;
  selected: boolean;
  onSelect: (reason: EvalReason) => void;
  canEdit?: boolean;
  onEdit?: (reasonId: string, score: number, reasonText: string, count?: number) => Promise<void>;
  onDelete?: (reasonId: string) => Promise<void>;
  isAdminReviewer?: boolean;
  onMarkNeedsRevision?: (reasonId: string, comment: string) => Promise<void>;
  onMarkApproved?: (reasonId: string) => Promise<void>;
  onMarkPending?: (reasonId: string) => Promise<void>;
  highlightStatus?: ReasonReviewStatus;
}

export const ReasonCard: React.FC<ReasonCardProps> = ({
  reason,
  selected,
  onSelect,
  canEdit = false,
  onEdit,
  onDelete,
  isAdminReviewer = false,
  onMarkNeedsRevision,
  onMarkApproved,
  onMarkPending,
  highlightStatus,
}) => {
  const isPositive = reason.type === 'positive';
  const isCustom = reason.type === 'custom' || reason.isCustom;
  const missingProof = reason.needProof && reason.proofFiles.length === 0;
  const isPending = reason.isPendingReview;

  const reviewStatus = highlightStatus ?? reason.reviewStatus;
  const reviewComment = reason.reviewComment;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editScore, setEditScore] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editCount, setEditCount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [needsRevisionDialogOpen, setNeedsRevisionDialogOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [markingNeedsRevision, setMarkingNeedsRevision] = useState(false);

  const badgeVariant = isCustom
    ? 'outline'
    : isPositive
      ? 'default'
      : 'destructive';

  const scoreColor = isCustom
    ? 'text-amber-600'
    : isPositive
      ? 'text-emerald-600'
      : 'text-rose-600';

  let borderColor = 'border-border';
  let ringClass = '';
  if (selected) {
    borderColor = 'border-primary';
    ringClass = 'ring-2 ring-primary/20';
  } else if (reviewStatus === 'needs_revision') {
    borderColor = 'border-amber-400';
    ringClass = 'ring-2 ring-amber-200';
  } else if (reviewStatus === 'approved') {
    borderColor = 'border-emerald-400';
    ringClass = 'ring-2 ring-emerald-200';
  }

  const openEditDialog = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditScore(String(reason.score));
    setEditReason(reason.reason || '');
    setEditCount(String(reason.count ?? 1));
    setEditDialogOpen(true);
  };

  const handleEditSave = async (): Promise<void> => {
    if (!onEdit) return;
    const scoreNum = Number(editScore);
    if (Number.isNaN(scoreNum)) return;
    let countNum = parseInt(editCount, 10);
    if (Number.isNaN(countNum) || countNum < 1) countNum = 1;
    if (countNum > 99) countNum = 99;
    setSubmitting(true);
    try {
      await onEdit(reason.id, scoreNum, editReason.trim(), countNum > 1 ? countNum : undefined);
      setEditDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!onDelete) return;
    const confirmed = await showConfirm('确定删除该条评分原因吗？此操作不可撤销。');
    if (!confirmed) return;
    await onDelete(reason.id);
  };

  const openNeedsRevisionDialog = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setRevisionComment(reviewComment || '');
    setNeedsRevisionDialogOpen(true);
  };

  const handleMarkNeedsRevision = async (): Promise<void> => {
    if (!onMarkNeedsRevision) return;
    setMarkingNeedsRevision(true);
    try {
      await onMarkNeedsRevision(reason.id, revisionComment.trim());
      setNeedsRevisionDialogOpen(false);
      toast.success('已标记待修改');
    } finally {
      setMarkingNeedsRevision(false);
    }
  };

  const handleMarkApproved = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!onMarkApproved) return;
    await onMarkApproved(reason.id);
    toast.success('已确认通过');
  };

  const handleMarkPending = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!onMarkPending) return;
    await onMarkPending(reason.id);
    toast.success('已重置为待审查');
  };

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md border-2 ${borderColor} ${ringClass}`}
      onClick={() => onSelect(reason)}
    >
      <CardContent className="relative p-4">
        {/* 审查状态角标 */}
        <div className="absolute right-2 top-2 flex gap-1 z-10">
          {reviewStatus === 'needs_revision' && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 border border-amber-200"
              title="待修改"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
          {reviewStatus === 'approved' && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200"
              title="已通过"
            >
              <ApproveCircle className="h-3.5 w-3.5" />
            </span>
          )}
          {missingProof && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 border border-rose-200"
              title="缺少证明文件"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}
          {(isCustom || isPending) && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200"
              title={isCustom ? '自定义/待认定' : '待认定'}
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {/* 顶部：项目名称 + 级别 + 分值 + 操作 */}
        <div className="mb-2 flex items-start justify-between gap-2 pr-12">
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="font-medium text-sm">
              {reason.projectName || '自定义项目'}
            </span>
            {reason.levelName && (
              <Badge variant={badgeVariant} className="text-xs">
                {reason.levelName}
              </Badge>
            )}
            {(reason.count ?? 1) > 1 && (
              <Badge variant="secondary" className="text-xs">
                ×{reason.count}次
              </Badge>
            )}
            {isCustom && (
              <Badge variant="outline" className="text-xs text-amber-600">
                自定义/待认定
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`font-bold text-base ${scoreColor}`}>
              {isPositive ? '+' : isCustom ? '' : '-'}
              {reason.score}分
            </span>
          </div>
        </div>

        {/* 中间：原因描述 */}
        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
          {reason.reason}
        </p>

        {/* 用户备注 */}
        {reason.remark && (
          <p className="mb-3 text-xs text-muted-foreground/80">
            备注：{reason.remark}
          </p>
        )}

        {/* 底部：证明文件列表 */}
        {reason.proofFiles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="mb-2 text-xs text-muted-foreground">
              证明文件（{reason.proofFiles.length}）
            </div>
            <div className="flex flex-wrap gap-2">
              {reason.proofFiles.map((file: ProofFile) =>
                isImageFile(file) ? (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Image
                      src={file.url}
                      alt={file.name}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-md object-cover border border-border"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                      <ZoomIn className="h-4 w-4 text-white" />
                    </div>
                  </a>
                ) : (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-accent transition-colors"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="max-w-[120px] truncate">{file.name}</span>
                  </a>
                ),
              )}
            </div>
          </div>
        )}

        {/* 修改意见展示 */}
        {reviewStatus === 'needs_revision' && reviewComment && (
          <div className="mt-3 rounded-md px-3 py-2 text-xs bg-amber-50 text-amber-700 border border-amber-200">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <MessageSquareWarning className="h-3.5 w-3.5" />
              修改意见
            </div>
            <p className="whitespace-pre-wrap">{reviewComment}</p>
          </div>
        )}

        {/* 管理员操作按钮区 */}
        {isAdminReviewer && (
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 text-xs h-7 px-2.5"
              onClick={openNeedsRevisionDialog}
            >
              <MessageSquareWarning className="h-3.5 w-3.5 mr-1" />
              标记待修改
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-xs h-7 px-2.5"
              onClick={handleMarkApproved}
            >
              <ApproveCircle className="h-3.5 w-3.5 mr-1" />
              确认通过
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-xs h-7 px-2.5"
              onClick={handleMarkPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              重置待审
            </Button>
          </div>
        )}

        {/* 学生端编辑/删除按钮 */}
        {canEdit && (
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-primary text-xs h-7 px-2.5"
              onClick={openEditDialog}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive text-xs h-7 px-2.5"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              删除
            </Button>
          </div>
        )}
      </CardContent>

      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑评分项</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">分值</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editScore}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditScore(e.target.value)
                  }
                />
              </div>
              <div className="space-y-2 w-24">
                <label className="text-sm font-medium">次数</label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={editCount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditCount(e.target.value)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">原因描述</label>
              <Textarea
                value={editReason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditReason(e.target.value)
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleEditSave} disabled={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 标记待修改对话框 */}
      <Dialog open={needsRevisionDialogOpen} onOpenChange={setNeedsRevisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>标记待修改</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">修改意见</label>
            <Textarea
              value={revisionComment}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setRevisionComment(e.target.value)
              }
              placeholder="请填写修改意见，学生端将看到具体哪条原因记录被标记及修改意见"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNeedsRevisionDialogOpen(false)}
              disabled={markingNeedsRevision}
            >
              取消
            </Button>
            <Button
              variant="default"
              onClick={handleMarkNeedsRevision}
              disabled={markingNeedsRevision}
            >
              {markingNeedsRevision ? '提交中...' : '确认标记待修改'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
