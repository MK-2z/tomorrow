import React, { useState, useMemo, useEffect } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

import { useScoringRules } from '@client/src/hooks/useScoringRules';
import type {
  EvalReason,
  ScoringRuleProject,
  ScoringRuleLevelGroup,
  ScoringRuleOption,
} from '@shared/api.interface';

type TabType = 'positive' | 'negative' | 'custom';

interface StandardReasonForm {
  type: 'positive' | 'negative';
  projectKey: string;
  levelKey: string;
  optionKey: string;
  remark: string;
  count: number;
}

interface CustomReasonForm {
  projectName: string;
  score: string;
  reason: string;
  remark: string;
  proofFiles: never[];
}

interface ReasonAddPanelProps {
  itemKey: string;
  itemMaxScore?: number;
  onCancel: () => void;
  onAdd: (reason: EvalReason) => void;
  genId: (prefix: string) => string;
}

const DEFAULT_STANDARD: StandardReasonForm = {
  type: 'positive',
  projectKey: '',
  levelKey: '',
  optionKey: '',
  remark: '',
  count: 1,
};

const DEFAULT_CUSTOM: CustomReasonForm = {
  projectName: '',
  score: '',
  reason: '',
  remark: '',
  proofFiles: [],
};

const ReasonAddPanel: React.FC<ReasonAddPanelProps> = ({
  itemKey,
  itemMaxScore,
  onCancel,
  onAdd,
  genId,
}) => {
  const { getPositiveProjects, getNegativeProjects, getLevelGroups, getOptions } =
    useScoringRules();

  const [tab, setTab] = useState<TabType>('positive');
  const [stdForm, setStdForm] = useState<StandardReasonForm>(DEFAULT_STANDARD);
  const [customForm, setCustomForm] = useState<CustomReasonForm>(DEFAULT_CUSTOM);

  const positiveProjects: ScoringRuleProject[] = getPositiveProjects(itemKey);
  const negativeProjects: ScoringRuleProject[] = getNegativeProjects(itemKey);

  const currentProjects: ScoringRuleProject[] =
    stdForm.type === 'positive' ? positiveProjects : negativeProjects;

  const selectedProject: ScoringRuleProject | undefined = currentProjects.find(
    (p: ScoringRuleProject) => p.projectKey === stdForm.projectKey,
  );

  const levelGroups: ScoringRuleLevelGroup[] = selectedProject
    ? getLevelGroups(itemKey, stdForm.projectKey)
    : [];

  const selectedLevel: ScoringRuleLevelGroup | undefined = levelGroups.find(
    (lg: ScoringRuleLevelGroup) => lg.levelKey === stdForm.levelKey,
  );

  const options: ScoringRuleOption[] = selectedProject && selectedLevel
    ? getOptions(itemKey, stdForm.projectKey, stdForm.levelKey)
    : [];

  const selectedOption: ScoringRuleOption | undefined = options.find(
    (o: ScoringRuleOption) => o.optionKey === stdForm.optionKey,
  );

  // 简化层级判断：
  // - 只有 1 个 levelGroup 且其下只有 1 个 option（optionKey=default, optionName=标准）
  //   → 跳过 level 和 option 两级
  // - 只有 1 个 levelGroup 但有多个 options
  //   → 跳过 level 选择，直接选 option
  // - 多个 levelGroups → 保留两级
  const skipLevel = useMemo((): boolean => {
    if (!selectedProject || levelGroups.length !== 1) return false;
    return true;
  }, [selectedProject, levelGroups]);

  const skipOption = useMemo((): boolean => {
    if (!skipLevel) return false;
    if (levelGroups.length !== 1) return false;
    const lg = levelGroups[0];
    if (lg.options.length !== 1) return false;
    const opt = lg.options[0];
    return opt.optionKey === 'default' && opt.optionName === '标准';
  }, [skipLevel, levelGroups]);

  // 选择项目时根据结构自动填充 level/option
  useEffect(() => {
    if (!selectedProject) return;
    if (skipOption && levelGroups.length === 1 && levelGroups[0].options.length === 1) {
      const lg = levelGroups[0];
      const opt = lg.options[0];
      setStdForm((prev) => ({
        ...prev,
        levelKey: lg.levelKey,
        optionKey: opt.optionKey,
      }));
    } else if (skipLevel && levelGroups.length === 1) {
      setStdForm((prev) => ({
        ...prev,
        levelKey: levelGroups[0].levelKey,
        optionKey: '',
      }));
    }
  }, [selectedProject, skipOption, skipLevel, levelGroups]);

  // 是否是志愿服务项目（双条件分级，次数×时长，存在不满足加分条件的组合）
  const isVolunteerService = selectedProject?.projectKey === 'volunteer-service';

  // 是否满足加分条件：选中组合的 score > 0 才满足
  const meetsAddCondition = selectedOption ? selectedOption.score > 0 : true;

  // 是否是单标准单一加分项目（项目单一且加分标准单一，无需证明）
  const isSingleStandardProject = useMemo((): boolean => {
    if (!selectedProject) return false;
    if (levelGroups.length !== 1) return false;
    const lg = levelGroups[0];
    if (lg.options.length !== 1) return false;
    const opt = lg.options[0];
    return opt.optionKey === 'default' && opt.optionName === '标准';
  }, [selectedProject, levelGroups]);

  const allSelected = Boolean(
    stdForm.projectKey &&
      stdForm.levelKey &&
      stdForm.optionKey &&
      selectedOption,
  );

  const handleTabChange = (value: string): void => {
    setTab(value as TabType);
  };

  const handleStdTypeChange = (type: string): void => {
    setStdForm({
      ...DEFAULT_STANDARD,
      type: type as 'positive' | 'negative',
    });
  };

  const handleProjectChange = (projectKey: string): void => {
    setStdForm((prev) => ({
      ...prev,
      projectKey,
      levelKey: '',
      optionKey: '',
      count: 1,
    }));
  };

  const handleCountChange = (countStr: string): void => {
    let count = parseInt(countStr, 10);
    if (Number.isNaN(count) || count < 1) count = 1;
    if (count > 99) count = 99;
    setStdForm((prev) => ({ ...prev, count }));
  };

  const handleLevelChange = (levelKey: string): void => {
    setStdForm((prev) => ({
      ...prev,
      levelKey,
      optionKey: '',
    }));
  };

  const handleOptionChange = (optionKey: string): void => {
    setStdForm((prev) => ({
      ...prev,
      optionKey,
    }));
  };

  const formatScore = (score: number, type: 'positive' | 'negative'): string => {
    const signedScore: number = type === 'negative' ? -Math.abs(score) : score;
    return signedScore >= 0 ? `+${signedScore}分` : `${signedScore}分`;
  };

  const buildReasonText = (): string => {
    if (!selectedProject || !selectedLevel || !selectedOption) return '';
    const parts: string[] = [selectedProject.projectName];
    if (selectedLevel.levelName !== '标准') {
      parts.push(selectedLevel.levelName);
    }
    if (selectedOption.optionName !== '标准') {
      parts.push(selectedOption.optionName);
    }
    let text = parts.join(' - ');
    if (selectedProject.repeatable && stdForm.count > 1) {
      text += `（×${stdForm.count}次）`;
    }
    return text;
  };

  const currentTotalScore = useMemo((): number => {
    if (!selectedOption) return 0;
    const count = selectedProject?.repeatable ? stdForm.count : 1;
    const raw = selectedOption.score * count;
    return stdForm.type === 'negative' ? -Math.abs(raw) : raw;
  }, [selectedOption, selectedProject, stdForm.count, stdForm.type]);

  const handleAddStandardReason = (): void => {
    if (!allSelected) {
      toast.error('请选择评分项目和分值项');
      return;
    }

    const count = selectedProject?.repeatable ? stdForm.count : 1;
    const rawScore: number = selectedOption!.score * count;
    const score: number =
      stdForm.type === 'negative' ? -Math.abs(rawScore) : rawScore;

    const newReason: EvalReason = {
      id: genId(itemKey),
      reason: buildReasonText(),
      score,
      type: stdForm.type,
      projectKey: selectedProject!.projectKey,
      projectName: selectedProject!.projectName,
      levelKey: selectedLevel!.levelKey,
      levelName: selectedLevel!.levelName,
      optionKey: selectedOption!.optionKey,
      optionName: selectedOption!.optionName,
      remark: stdForm.remark.trim(),
      needProof:
        stdForm.type === 'positive' && !isSingleStandardProject,
      isCustom: false,
      isPendingReview: false,
      count: selectedProject?.repeatable ? count : undefined,
      proofFiles: [],
    };
    onAdd(newReason);
  };

  const handleAddCustomReason = (): void => {
    if (!customForm.projectName.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    const scoreNum = Number(customForm.score);
    if (!customForm.score.trim() || Number.isNaN(scoreNum) || scoreNum <= 0) {
      toast.error('请输入有效正分分值');
      return;
    }
    if (itemMaxScore !== undefined && itemMaxScore > 0 && scoreNum > itemMaxScore) {
      toast.error(`分值不能超过该指标上限（${itemMaxScore}分）`);
      return;
    }
    if (!customForm.reason.trim()) {
      toast.error('请填写原因/说明');
      return;
    }

    const newReason: EvalReason = {
      id: genId(itemKey),
      reason: customForm.reason.trim(),
      score: scoreNum,
      type: 'custom',
      projectName: customForm.projectName.trim(),
      remark: customForm.remark.trim(),
      needProof: true,
      isCustom: true,
      isPendingReview: true,
      proofFiles: [],
    };
    onAdd(newReason);
  };

  const renderStandardSelector = (type: 'positive' | 'negative') => {
    const projects = type === 'positive' ? positiveProjects : negativeProjects;
    if (projects.length === 0) {
      return (
        <div className="text-xs text-muted-foreground">
          该指标下暂无{type === 'positive' ? '正向' : '负向'}评分项
        </div>
      );
    }

    const showLevelSelect = !skipLevel;
    const showOptionSelect = !skipOption;
    const scoreColor = type === 'positive' ? 'text-emerald-600' : 'text-rose-600';

    return (
      <>
        {/* 第一级：项目选择 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">评分项目</label>
          <Select
            value={stdForm.projectKey}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="请选择评分项目" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project: ScoringRuleProject) => (
                <SelectItem
                  key={project.projectKey}
                  value={project.projectKey}
                >
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 第二级：级别选择（单 levelGroup 时跳过） */}
        {showLevelSelect && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              {isVolunteerService ? '次数' : '级别'}
            </label>
            <Select
              value={stdForm.levelKey}
              onValueChange={handleLevelChange}
              disabled={!selectedProject}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={isVolunteerService ? '请选择次数' : '请选择级别'} />
              </SelectTrigger>
              <SelectContent>
                {levelGroups.map((lg: ScoringRuleLevelGroup) => (
                  <SelectItem key={lg.levelKey} value={lg.levelKey}>
                    {lg.levelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 第三级：分值项选择（单 option 时跳过） */}
        {showOptionSelect && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              {isVolunteerService ? '时长' : '分值项'}
            </label>
            <Select
              value={stdForm.optionKey}
              onValueChange={handleOptionChange}
              disabled={!skipLevel ? !selectedLevel : !selectedProject}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={isVolunteerService ? '请选择时长' : '请选择分值项'} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option: ScoringRuleOption) => (
                  <SelectItem key={option.optionKey} value={option.optionKey}>
                    {option.optionName}（{formatScore(option.score, type)}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 志愿服务组合不满足加分条件提示 */}
        {isVolunteerService && allSelected && !meetsAddCondition && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>未达到志愿服务加分最低条件，无法加分</span>
          </div>
        )}

        {/* 全选后的预览 + 添加按钮 */}
        {allSelected && selectedProject && (
          <div className="space-y-2 rounded bg-muted/50 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{buildReasonText()}</span>
              <span className={`font-semibold ${scoreColor}`}>
                {formatScore(
                  selectedProject.repeatable
                    ? Math.abs(currentTotalScore)
                    : selectedOption!.score,
                  type,
                )}
              </span>
            </div>
            {selectedProject.remark && (
              <div className="text-xs font-semibold text-muted-foreground">
                {selectedProject.remark}
              </div>
            )}
            {stdForm.type === 'positive' && !isSingleStandardProject && allSelected && selectedProject && (
              <div className="flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3 w-3" />
                <span>该项目需上传证明文件</span>
              </div>
            )}
          </div>
        )}

        {/* 次数输入（仅 repeatable 项目且全部选完后显示） */}
        {selectedProject?.repeatable && allSelected && meetsAddCondition && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">次数</label>
            <Input
              type="number"
              min={1}
              max={99}
              value={stdForm.count}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleCountChange(e.target.value)
              }
              className="h-8 text-sm w-24"
            />
          </div>
        )}

        {/* 用户备注输入 */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">备注</label>
          <Input
            value={stdForm.remark}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setStdForm((prev) => ({ ...prev, remark: e.target.value }))
            }
            placeholder="备注（选填）"
            className="h-8 text-sm"
          />
        </div>
      </>
    );
  };

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="positive">正向分</TabsTrigger>
          <TabsTrigger value="negative">负向分</TabsTrigger>
          <TabsTrigger value="custom">自定义指标</TabsTrigger>
        </TabsList>

        <TabsContent value="positive" className="space-y-3 pt-2">
          {renderStandardSelector('positive')}
        </TabsContent>

        <TabsContent value="negative" className="space-y-3 pt-2">
          {renderStandardSelector('negative')}
        </TabsContent>

        <TabsContent value="custom" className="space-y-3 pt-2">
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">项目名称 <span className="text-rose-500">*</span></label>
              <Input
                value={customForm.projectName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCustomForm((prev) => ({ ...prev, projectName: e.target.value }))
                }
                placeholder="请输入项目名称"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                分值 <span className="text-rose-500">*</span>
                {itemMaxScore !== undefined && itemMaxScore > 0
                  ? `（最高 ${itemMaxScore} 分）`
                  : ''}
              </label>
              <Input
                type="number"
                step="0.1"
                value={customForm.score}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCustomForm((prev) => ({ ...prev, score: e.target.value }))
                }
                placeholder="请输入分值"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                原因/说明 <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={customForm.reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setCustomForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="请详细说明加分原因"
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">备注</label>
              <Input
                value={customForm.remark}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCustomForm((prev) => ({ ...prev, remark: e.target.value }))
                }
                placeholder="备注（选填）"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-medium">自定义指标说明</div>
                <div>提交后状态为「待认定」，需管理员审查确认后方可计入总分。请务必上传证明文件。</div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" />
          取消
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (tab === 'custom') {
              handleAddCustomReason();
            } else {
              handleAddStandardReason();
            }
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          添加
        </Button>
      </div>
    </div>
  );
};

export default ReasonAddPanel;
