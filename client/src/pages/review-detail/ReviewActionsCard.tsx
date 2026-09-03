import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import type { ReviewStatus } from '@shared/api.interface';

interface ReviewActionsCardProps {
  onReview: (status: ReviewStatus, comment?: string) => Promise<void>;
  allItemsConfirmed: boolean;
  totalItems: number;
  approvedItems: number;
}

const ACTION_LABEL_MAP: Record<string, string> = {
  approved: '通过',
  needs_revision: '打回',
};

export const ReviewActionsCard: React.FC<ReviewActionsCardProps> = ({
  onReview,
  allItemsConfirmed,
  totalItems,
  approvedItems,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<'approved' | 'needs_revision'>('approved');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openDialog = (status: 'approved' | 'needs_revision') => {
    setAction(status);
    setComment('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (action === 'needs_revision' && !comment.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await onReview(action, comment.trim() || undefined);
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel = ACTION_LABEL_MAP[action];

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="text-xs text-muted-foreground mb-1">
          审查进度：已确认 {approvedItems} / 共 {totalItems} 个指标
        </div>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => openDialog('approved')}
          disabled={!allItemsConfirmed}
          title={
            allItemsConfirmed ? '' : '请先逐一对所有指标进行确认后再通过'
          }
        >
          <Check className="mr-2 h-4 w-4" />
          通过
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => openDialog('needs_revision')}
        >
          <X className="mr-2 h-4 w-4" />
          打回
        </Button>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabel}审查</DialogTitle>
            <DialogDescription>
              {action === 'approved'
                ? '确认通过该学生的素质评价审查吗？'
                : '请填写打回意见，学生将收到通知并可修改后重新提交。'}
            </DialogDescription>
          </DialogHeader>
          {action === 'needs_revision' && (
            <div className="py-4">
              <Textarea
                placeholder="请输入打回原因..."
                value={comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setComment(e.target.value)
                }
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant={action === 'needs_revision' ? 'destructive' : 'default'}
              className={action === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
              onClick={handleSubmit}
              disabled={submitting || (action === 'needs_revision' && !comment.trim())}
            >
              {submitting ? '提交中...' : `确认${actionLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
