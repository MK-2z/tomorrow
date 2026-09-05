import React, { useRef, useState, useMemo } from 'react';
import { logger } from '@/utils/logger';
import { getDataloom } from '@/compat';
import { getDefaultBucketId } from '@/compat';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Paperclip,
  Loader2,
  FileText,
  X,
  AlertTriangle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import { UniversalLink } from '@/compat/UniversalLink';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { useScoringRules } from '@client/src/hooks/useScoringRules';
import ReasonAddPanel from './ReasonAddPanel';
import type {
  EvalReason,
  ProofFile,
  ScoringRuleProject,
  ScoringRuleLevelGroup,
  ScoringRuleOption,
} from '@shared/api.interface';

interface EvalReasonsCellProps {
  itemKey: string;
  itemMaxScore?: number;
  studentId?: string;
  studentName?: string;
  itemName?: string;
  reasons: EvalReason[];
  onReasonsChange: (reasons: EvalReason[]) => void;
  readOnly?: boolean;
}

const genId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const EvalReasonsCell: React.FC<EvalReasonsCellProps> = ({
  itemKey,
  itemMaxScore,
  reasons,
  onReasonsChange,
  readOnly = false,
}) => {
  const { getProjectsByItem, getLevelGroups, getOptions } = useScoringRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingReasonId, setUploadingReasonId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const allProjects: ScoringRuleProject[] = getProjectsByItem(itemKey);

  const currentTotalScore: number = useMemo(
    () => reasons.reduce((sum: number, r: EvalReason) => sum + (r.score || 0), 0),
    [reasons],
  );

  const isOverLimit: boolean =
    itemMaxScore !== undefined &&
    itemMaxScore > 0 &&
    currentTotalScore > itemMaxScore;

  const isSingleStandardProject = (reason: EvalReason): boolean => {
    if (!reason.projectKey) return false;
    const project = allProjects.find((p: ScoringRuleProject) => p.projectKey === reason.projectKey);
    if (!project) return false;
    const levelGroups = getLevelGroups(itemKey, reason.projectKey);
    if (levelGroups.length !== 1) return false;
    const lg = levelGroups[0];
    if (lg.options.length !== 1) return false;
    const opt = lg.options[0];
    return opt.optionKey === 'default' && opt.optionName === '标准';
  };

  /**
   * 格式化原因展示文本：
   * - 优先按 key 匹配三级结构，按规则拼接：项目 - 级别 - 选项
   * - 级别为「标准」时省略；选项为「标准」时省略
   * - key 匹配不到时兼容旧数据，直接显示 reason 字段
   */
  const formatReasonDisplay = (reason: EvalReason): string => {
    if (!reason) return '-';
    if (reason.type === 'custom' || reason.isCustom) return reason.reason || '-';

    // 有 projectKey 时用 key 匹配
    if (reason.projectKey) {
      const project: ScoringRuleProject | undefined = allProjects.find(
        (p: ScoringRuleProject) => p.projectKey === reason.projectKey,
      );
      if (project) {
        const parts: string[] = [project.projectName];

        if (reason.levelKey) {
          const levelGroups: ScoringRuleLevelGroup[] = getLevelGroups(
            itemKey,
            reason.projectKey,
          );
          const level: ScoringRuleLevelGroup | undefined = levelGroups.find(
            (lg: ScoringRuleLevelGroup) => lg.levelKey === reason.levelKey,
          );
          if (level && level.levelName !== '标准') {
            parts.push(level.levelName);
          }
        } else if (reason.levelName && reason.levelName !== '标准') {
          // 旧数据兜底：只有 levelName 没有 levelKey
          parts.push(reason.levelName);
        }

        if (reason.optionKey && reason.levelKey) {
          const options: ScoringRuleOption[] = getOptions(
            itemKey,
            reason.projectKey,
            reason.levelKey,
          );
          const option: ScoringRuleOption | undefined = options.find(
            (o: ScoringRuleOption) => o.optionKey === reason.optionKey,
          );
          if (option && option.optionName !== '标准') {
            parts.push(option.optionName);
          }
        } else if (reason.optionName && reason.optionName !== '标准') {
          parts.push(reason.optionName);
        }

        let text = parts.join(' - ');
        const count = reason.count ?? 1;
        if (count > 1) {
          text += `（×${count}次）`;
        }
        return text;
      }
    }

    // 兜底：旧数据（只有 projectName/levelName，没有 key）
    if (reason.reason) {
      // 兼容历史数据：去掉末尾的 "-默认"
      return reason.reason.replace(/-默认$/, '');
    }

    return reason.projectName || '-';
  };

  const handleAddReason = (newReason: EvalReason): void => {
    onReasonsChange([...reasons, newReason]);
    setShowAddPanel(false);
  };

  const handleCancelAdd = (): void => {
    setShowAddPanel(false);
  };

  const removeReason = (index: number): void => {
    onReasonsChange(reasons.filter((_: EvalReason, i: number) => i !== index));
  };

  const updateReasonFiles = (
    reasonId: string,
    files: ProofFile[],
  ): void => {
    onReasonsChange(
      reasons.map((r: EvalReason) =>
        r.id === reasonId ? { ...r, proofFiles: files } : r,
      ),
    );
  };

  const triggerUpload = (reasonId: string): void => {
    setUploadingReasonId(reasonId);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    const reasonId = uploadingReasonId;
    if (!file || !reasonId) return;

    const reason = reasons.find((r: EvalReason) => r.id === reasonId);
    if (!reason) return;

    setUploadingReasonId(reasonId);
    try {
      const dataloom = await getDataloom();
      const { data, error } = await dataloom
        .storage
        .from(getDefaultBucketId())
        .uploadFile(file);
      if (error || !data) {
        throw new Error(
          `上传失败: ${String(
            error?.message ?? (error as { error_msg?: string })?.error_msg ?? '未知错误',
          )}`,
        );
      }
      const newFile: ProofFile = {
        id: `${reasonId}-${Date.now()}`,
        name: file.name,
        url: data.download_url,
        reasonId,
      };
      updateReasonFiles(reasonId, [...(reason.proofFiles || []), newFile]);
      toast.success(`${file.name} 上传成功`);
    } catch (err) {
      logger.error(`证明文件上传失败: ${String(err)}`);
      toast.error(String(err));
    } finally {
      setUploadingReasonId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeFile = (reasonId: string, fileId: string): void => {
    const reason = reasons.find((r: EvalReason) => r.id === reasonId);
    if (!reason) return;
    updateReasonFiles(
      reasonId,
      (reason.proofFiles || []).filter((f: ProofFile) => f.id !== fileId),
    );
  };

  const getTypeBadgeVariant = (type: EvalReason['type']) => {
    switch (type) {
      case 'positive':
        return 'default';
      case 'negative':
        return 'destructive';
      case 'custom':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getTypeLabel = (type: EvalReason['type']): string => {
    switch (type) {
      case 'positive':
        return '正向分';
      case 'negative':
        return '负向分';
      case 'custom':
        return '自定义/待认定';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-3 text-left">
      {/* 超限提示 */}
      {isOverLimit && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            当前得分 {currentTotalScore} 已超过该指标上限 {itemMaxScore}，超出部分可能不计入总分。
          </span>
        </div>
      )}

      {/* 原因列表 */}
      {reasons.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">暂无评分记录，点击下方添加</div>
      ) : (
        <div className="space-y-2">
          {reasons.map((reason: EvalReason, rIdx: number) => {
            const rowOverLimit: boolean =
              itemMaxScore !== undefined &&
              itemMaxScore > 0 &&
              reasons
                .slice(0, rIdx + 1)
                .reduce((sum: number, r: EvalReason) => sum + (r.score || 0), 0) >
                itemMaxScore;

            return (
              <Card
                key={reason.id}
                className={`border-2 ${
                  reason.reviewStatus === 'needs_revision'
                    ? 'border-amber-400 ring-2 ring-amber-200 bg-amber-50/30'
                    : reason.reviewStatus === 'approved'
                      ? 'border-emerald-300 bg-emerald-50/20'
                      : rowOverLimit
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-border'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 shrink-0 text-xs text-muted-foreground">
                      {rIdx + 1}.
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* 顶部：类型标签 + 原因 + 分值 + 操作 */}
                      <div className="flex items-center gap-2">
                         <Badge
                           variant={getTypeBadgeVariant(reason.type)}
                           className="shrink-0"
                         >
                           {getTypeLabel(reason.type)}
                         </Badge>
                         {(reason.count ?? 1) > 1 && (
                           <Badge variant="secondary" className="shrink-0 text-xs">
                             ×{reason.count}次
                           </Badge>
                         )}
                         <span className="min-w-0 flex-1 truncate text-sm font-medium">
                           {formatReasonDisplay(reason)}
                         </span>
                          <span
                           className={`shrink-0 text-sm font-semibold ${
                             reason.score >= 0 ? 'text-emerald-600' : 'text-rose-600'
                           }`}
                         >
                           {reason.score >= 0 ? '+' : ''}
                           {reason.score}
                         </span>
                         {!readOnly && (
                           <div className="flex shrink-0 items-center gap-1">
                             <Button
                               variant="outline"
                               size="icon"
                               onClick={() => triggerUpload(reason.id)}
                               disabled={uploadingReasonId === reason.id}
                               className="h-7 w-7"
                               title="上传证明文件"
                             >
                               {uploadingReasonId === reason.id ? (
                                 <Loader2 className="h-3.5 w-3.5 animate-spin" />
                               ) : (
                                 <Paperclip className="h-3.5 w-3.5" />
                               )}
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => removeReason(rIdx)}
                               className="h-7 w-7 text-destructive hover:text-destructive"
                               title="删除"
                             >
                               <Trash2 className="h-3.5 w-3.5" />
                             </Button>
                           </div>
                         )}
                       </div>

                       {/* 用户备注 */}
                       {reason.remark && (
                         <div className="text-xs text-muted-foreground">
                           备注：{reason.remark}
                         </div>
                       )}

                        {/* 需证明 / 待认定提示 */}
                        {(() => {
                          const isNegative = reason.type === 'negative' || Number(reason.score) < 0;
                          if (isNegative) return null;
                          const isCustom = reason.type === 'custom' || reason.isCustom;
                          const needsProof = isCustom || (reason.type === 'positive' && !isSingleStandardProject(reason));
                          if (!needsProof) return null;
                          if ((reason.proofFiles?.length ?? 0) > 0) return null;
                         return (
                           <div className="flex items-center gap-1 text-xs text-rose-600">
                             <AlertTriangle className="h-3 w-3" />
                             <span>需上传证明文件</span>
                           </div>
                         );
                       })()}
                      {reason.isPendingReview && (
                        <div className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>待认定（自定义评分项需审查确认）</span>
                        </div>
                      )}

                      {/* 原因级待修改意见 */}
                      {reason.reviewStatus === 'needs_revision' && reason.reviewComment && (
                        <div className="mt-1 rounded-md px-2 py-1.5 text-xs bg-amber-100 text-amber-700 border border-amber-200">
                          <div className="flex items-center gap-1 font-medium mb-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            修改意见
                          </div>
                          <p className="whitespace-pre-wrap">{reason.reviewComment}</p>
                        </div>
                      )}

                      {/* 证明文件列表 */}
                      {(reason.proofFiles?.length ?? 0) > 0 && (
                        <ul className="space-y-1 pl-4 pt-1">
                          {reason.proofFiles!.map((f: ProofFile) => (
                            <li
                              key={f.id}
                              className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-xs"
                            >
                              <UniversalLink
                                to={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-w-0 flex-1 items-center gap-1 truncate hover:underline"
                              >
                                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate">{f.name}</span>
                              </UniversalLink>
                              {!readOnly && (
                                <button
                                  onClick={() => removeFile(reason.id, f.id)}
                                  className="shrink-0 text-destructive hover:opacity-70"
                                  title="删除文件"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 添加面板 */}
      {!readOnly && showAddPanel && (
        <Card className="border-dashed">
          <CardContent className="p-3">
             <ReasonAddPanel
               itemKey={itemKey}
               itemMaxScore={itemMaxScore}
               onCancel={handleCancelAdd}
               onAdd={handleAddReason}
               genId={genId}
             />
          </CardContent>
        </Card>
      )}

      {/* 添加按钮 */}
      {!readOnly && !showAddPanel && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPanel(true)}
            className="h-8 text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            添加记录
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        className="hidden"
        multiple
      />
    </div>
  );
};

export default EvalReasonsCell;
