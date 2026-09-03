import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import type { QualityEvalRecord, ReviewStatus } from '@shared/api.interface';

const STATUS_LABEL_MAP: Record<ReviewStatus, string> = {
  pending: '待审查',
  approved: '已通过',
  rejected: '已驳回',
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

interface StudentInfoCardProps {
  detail: QualityEvalRecord;
  statusIcon: React.ReactNode;
}

export const StudentInfoCard: React.FC<StudentInfoCardProps> = ({
  detail,
  statusIcon,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">学生信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">学号</span>
          <span className="font-medium">{detail.studentId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">班级</span>
          <span className="font-medium">{detail.className}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">姓名</span>
          <span className="font-medium">{detail.studentName}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">审查状态</span>
          <Badge variant={getStatusBadgeVariant(detail.reviewStatus)}>
            <span className="flex items-center gap-1">
              {statusIcon}
              {STATUS_LABEL_MAP[detail.reviewStatus]}
            </span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

interface ScoreSummaryCardProps {
  qualityScore: number;
}

export const ScoreSummaryCard: React.FC<ScoreSummaryCardProps> = ({
  qualityScore,
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">分数汇总</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">素质测评分数</span>
          <span className="text-2xl font-bold text-emerald-600">{qualityScore}</span>
        </div>
        <p className="text-xs text-muted-foreground">加分 - 扣分（附加分最高20分封顶）</p>
      </CardContent>
    </Card>
  );
};
