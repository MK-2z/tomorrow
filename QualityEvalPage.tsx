import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquareWarning,
  Clock,
  Check,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

import {
  createQualityEval,
  getFillTimeSettings,
  getQualityEvalDetail,
  updateQualityEval,
  getQualityEvalList,
} from '@/api/quality-eval';

import EvalReasonsCell from './EvalReasonsCell';
import {
  buildInitialCategories,
  getTotalRows,
  ITEM_MAX_SCORES,
  CATEGORY_MAX_SCORES,
  BASE_SCORE_ITEMS,
  computeItemScore,
  computeCategoryScore,
  computeQualityScore,
  normalizeEvalRecordScores,
  getCatStartIndices,
} from './evalCategories';
import { useScoringRules } from '@/hooks/useScoringRules';
import { useAuth } from '@client/src/contexts/AuthContext';

import type {
  EvalCategory,
  EvalItem,
  EvalReason,
  FillTimeSettings,
  ItemReviewState,
} from '@shared/api.interface';

const genId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const migrateReasonsWithIds = (cats: EvalCategory[]): EvalCategory[] => {
  return cats.map((cat: EvalCategory) => ({
    ...cat,
    items: cat.items.map((item: EvalItem) => ({
      ...item,
      reasons: (item.reasons ?? []).map((r: EvalReason, idx: number) => {
        if (r.id) return r;
        return {
          ...r,
          id: genId(`${item.itemKey}-r${idx}`),
          proofFiles: r.proofFiles ?? [],
        };
      }),
    })),
  }));
};

const initialCategories: EvalCategory[] = buildInitialCategories();

const totalRows = getTotalRows(initialCategories);

const QualityEvalPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const mode = searchParams.get('mode');
  const isView = mode === 'view';
  const isEdit = Boolean(editId) && !isView;

  const { currentUser, updateProfile } = useAuth();
  const isStudent = currentUser?.role === 'student';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  // 学生身份：role=student 或 管理员但有学生身份（学生管理员自己也可以填评价）
  const hasStudentIdentity = Boolean(currentUser?.studentId);
  // 以「学生身份」编辑/查看自己的记录：学生角色 或 学生管理员访问自己的记录
  const isSelfStudentMode = isStudent || (isAdmin && hasStudentIdentity && editId && !isView);
  // 学生登录后学号可手动输入（不自动填充，也不设为只读）
  // 仅在查看模式或管理员编辑他人记录时，学号才只读
  const studentIdReadOnly = pageReadOnly || (isAdmin && editId && !isSelfStudentMode);

  const [studentId, setStudentId] = useState('');
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');

  const [categories, setCategories] = useState<EvalCategory[]>(initialCategories);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordStatus, setRecordStatus] = useState<string>('');
  const [resubmitted, setResubmitted] = useState(false);
  const [revisionExpanded, setRevisionExpanded] = useState(false);

  const [fillTimeSettings, setFillTimeSettings] = useState<FillTimeSettings | null>(null);
  const [fillTimeLoading, setFillTimeLoading] = useState(false);
  const [myRecord, setMyRecord] = useState<{ id: string; reviewStatus: string } | null>(null);
  const [myRecordLoading, setMyRecordLoading] = useState(false);

  const { getLevelGroups, getProjectsByItem } = useScoringRules();

  const isSingleStandardProject = (itemKey: string, projectKey?: string): boolean => {
    if (!projectKey) return false;
    const levelGroups = getLevelGroups(itemKey, projectKey);
    if (levelGroups.length !== 1) return false;
    const lg = levelGroups[0];
    if (lg.options.length !== 1) return false;
    const opt = lg.options[0];
    return opt.optionKey === 'default' && opt.optionName === '标准';
  };

  // 填写时间是否在允许范围内（学生身份才受限制）
  const isFillTimeAllowed = useMemo((): boolean => {
    if (!hasStudentIdentity) return true;
    if (!fillTimeSettings) return true;
    if (fillTimeSettings.mode === 'always') return true;
    const now = Date.now();
    const start = fillTimeSettings.start ? new Date(fillTimeSettings.start).getTime() : 0;
    const end = fillTimeSettings.end ? new Date(fillTimeSettings.end).getTime() : Infinity;
    return now >= start && now <= end;
  }, [hasStudentIdentity, fillTimeSettings]);

  // 是否只读
  // - 查看模式 / 已通过 / 待修改且已使用过重新提交机会
  // - 学生不在填写时间内（needs_revision编辑模式且未使用过重新提交机会除外）
  // - 学生已有待审查记录
  const pageReadOnly = useMemo((): boolean => {
    if (isView) return true;
    if (recordStatus === 'approved') return true;
    if (recordStatus === 'needs_revision' && resubmitted) return true;
    if (hasStudentIdentity && !isFillTimeAllowed && !(isEdit && recordStatus === 'needs_revision' && !resubmitted)) return true;
    if (hasStudentIdentity && !editId && myRecord?.reviewStatus === 'pending') return true;
    return false;
  }, [isView, recordStatus, resubmitted, hasStudentIdentity, isFillTimeAllowed, isEdit, editId, myRecord]);


  // 学生登录后不自动填写班级姓名和学号，所有字段留空可编辑
  // useEffect(() => {
  //   if (editId) return;
  //   if (!currentUser) return;
  //   if (!hasStudentIdentity) return;
  //   if (studentId || className || studentName) return;
  //   setStudentId(currentUser.studentId);
  //   setClassName(currentUser.className || '');
  //   setStudentName(currentUser.displayName || '');
  // }, [editId, currentUser, hasStudentIdentity, studentId, className, studentName]);

  useEffect(() => {
    // 学生身份新建模式下：自动查询自己是否已有记录
    if (editId) return;
    if (!hasStudentIdentity || !currentUser?.studentId) return;
    const loadMyRecord = async (): Promise<void> => {
      setMyRecordLoading(true);
      try {
        const data = await getQualityEvalList({ page: 1, pageSize: 20 });
        if (data.items && data.items.length > 0) {
          const sorted = [...data.items].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          const latest = sorted[0];
          setMyRecord({ id: latest.id, reviewStatus: latest.reviewStatus });
          if (latest.reviewStatus === 'needs_revision') {
            navigate(`/eval?id=${latest.id}&mode=edit`, { replace: true });
          }
        }
      } catch (err) {
        logger.error(`查询自己的评价记录失败: ${String(err)}`);
      } finally {
        setMyRecordLoading(false);
      }
    };
    loadMyRecord();
  }, [editId, hasStudentIdentity, currentUser, navigate]);

  useEffect(() => {
    // 加载填写时间设置（学生身份才需要）
    if (!hasStudentIdentity) return;
    const loadFillTime = async (): Promise<void> => {
      setFillTimeLoading(true);
      try {
        const data = await getFillTimeSettings();
        setFillTimeSettings(data);
      } catch (error) {
        logger.error('获取填写时间设置失败', error);
      } finally {
        setFillTimeLoading(false);
      }
    };
    loadFillTime();
  }, [hasStudentIdentity]);

  const [reviewItemStatus, setReviewItemStatus] = useState<Record<string, ItemReviewState>>({});

  useEffect(() => {
    if (!editId) return;
    const loadDetail = async (): Promise<void> => {
      setLoading(true);
      try {
        const record = await getQualityEvalDetail(editId);
        setStudentId(record.studentId);
        setClassName(record.className);
        setStudentName(record.studentName);
         setRecordStatus(record.reviewStatus);
         setReviewItemStatus(record.reviewItemStatus || {});
         setResubmitted(record.resubmitted ?? false);

        // 学生身份编辑已有评价时，如 record 中的姓名/班级比 currentUser 全，也同步档案
        if (hasStudentIdentity && currentUser) {
          const nameMoreComplete =
            record.studentName && !currentUser.displayName
              ? record.studentName.trim()
              : null;
          const classMoreComplete =
            record.className && !currentUser.className
              ? record.className.trim()
              : null;
          if (nameMoreComplete || classMoreComplete) {
            const displayName = nameMoreComplete || currentUser.displayName || '';
            const clsName = classMoreComplete || currentUser.className || '';
            updateProfile(displayName, clsName).catch((err) => {
              logger.warn('编辑回填时同步学生档案失败', err);
            });
          }
        }

        const normalized = normalizeEvalRecordScores(record);
        const loadedCats = migrateReasonsWithIds(normalized.categories);
        const mergedCats = loadedCats.map((cat: EvalCategory) => ({
          ...cat,
          categoryMaxScore: CATEGORY_MAX_SCORES[cat.categoryKey] ?? cat.categoryMaxScore,
          isExtra: cat.isExtra ?? cat.categoryKey === 'expansion',
          items: cat.items.map((item: EvalItem) => ({
            ...item,
            itemMaxScore: ITEM_MAX_SCORES[item.itemKey] ?? item.itemMaxScore,
          })),
        }));
        setCategories(mergedCats);
      } catch (err) {
        logger.error(`加载评价详情失败: ${String(err)}`);
        toast.error('加载评价详情失败');
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [editId]);

  const needsRevisionItemList = useMemo(() => {
    const list: { itemKey: string; itemName: string; comment?: string }[] = [];
    if (!reviewItemStatus) return list;
    for (const cat of categories) {
      for (const item of cat.items) {
        const state = reviewItemStatus[item.itemKey];
        if (state?.status === 'needs_revision') {
          list.push({
            itemKey: item.itemKey,
            itemName: item.itemName,
            comment: state.comment,
          });
        }
      }
    }
    return list;
  }, [categories, reviewItemStatus]);

  const isItemNeedsRevision = (itemKey: string): boolean => {
    return reviewItemStatus?.[itemKey]?.status === 'needs_revision';
  };

  const qualityScore = useMemo(() => computeQualityScore(categories), [categories]);

  const totalScore = qualityScore;

  // 每个一级分类起始行的全局索引（用于斑马纹计算）
  const catStartIndices = useMemo(
    () => getCatStartIndices(categories),
    [categories],
  );

  const handleReasonsChange = (
    categoryKey: string,
    itemKey: string,
    reasons: EvalReason[],
  ): void => {
    setCategories((prev: EvalCategory[]) =>
      prev.map((cat: EvalCategory) =>
        cat.categoryKey !== categoryKey
          ? cat
          : {
              ...cat,
              items: cat.items.map((item: EvalItem) =>
                item.itemKey !== itemKey
                  ? item
                  : {
                      ...item,
                      reasons,
                      itemScore: computeItemScore({ ...item, reasons }, item.itemKey, item.itemMaxScore),
                    },
              ),
            },
      ),
    );
  };

  const handleSubmit = async (): Promise<void> => {
    if (!studentId.trim()) {
      toast.error('请输入学号');
      return;
    }
    if (!className.trim()) {
      toast.error('请输入班级');
      return;
    }
    if (!studentName.trim()) {
      toast.error('请输入姓名');
      return;
    }

    const missingProofItems: string[] = [];
    for (const cat of categories) {
      for (const item of cat.items) {
        for (const reason of item.reasons) {
          const isNegative = reason.type === 'negative' || Number(reason.score) < 0;
          if (isNegative) continue;
          const isCustom = reason.type === 'custom' || reason.isCustom;
          let needsProof = isCustom;
          if (reason.type === 'positive' && !isCustom) {
            // 正向分项目：单标准单一加分项目无需证明，其余需要证明
            needsProof = !isSingleStandardProject(item.itemKey, reason.projectKey);
          }
          if (needsProof && (reason.proofFiles?.length ?? 0) === 0) {
            const label = isCustom
              ? `${item.itemName}-自定义（待认定）-${reason.reason || '未命名项'}`
              : `${item.itemName}-${reason.reason || '未命名项'}`;
            missingProofItems.push(label);
          }
        }
      }
    }
    if (missingProofItems.length > 0) {
      toast.error(`以下项目缺少证明文件：${missingProofItems.join('；')}，请上传后再提交`, {
        duration: 6000,
      });
      return;
    }

    const finalCategories: EvalCategory[] = categories.map((cat: EvalCategory) => ({
      ...cat,
      categoryScore: computeCategoryScore(cat),
items: cat.items.map((item: EvalItem) => ({
         ...item,
         itemScore: computeItemScore(item, item.itemKey, item.itemMaxScore),
      })),
    }));

    const payload = {
      studentId,
      className,
      studentName,
      totalScore: qualityScore,
      qualityScore,
      categories: finalCategories,
    };

    setSubmitting(true);
    try {
      if (isEdit && editId) {
        await updateQualityEval(editId, payload);
        toast.success('更新成功');
      } else {
        await createQualityEval(payload);
        toast.success('提交成功');
      }

      // 学生身份提交后，如姓名/班级与档案不同，同步更新用户档案
      if (hasStudentIdentity && currentUser) {
        const nameDiffers = (currentUser.displayName || '') !== studentName.trim();
        const classDiffers = (currentUser.className || '') !== className.trim();
        if (nameDiffers || classDiffers) {
          updateProfile(studentName.trim(), className.trim()).catch((err) => {
            logger.warn('同步更新学生档案失败', err);
          });
        }
      }
    } catch (err) {
      logger.error(`提交素质评价失败: ${String(err)}`);
      toast.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <Card className="mx-auto max-w-[1400px]">
         <CardHeader>
             <CardTitle className="text-center text-2xl font-bold">
               {isView ? '学生素质评价详情' : isEdit ? '编辑学生素质评价表' : '学生素质评价表'}
             </CardTitle>
         </CardHeader>
         <CardContent>
            {/* 填写时间限制提示 */}
            {hasStudentIdentity && !isFillTimeAllowed && !fillTimeLoading && (
             <Alert variant="warning" className="mb-4">
               <AlertTriangle className="size-4" />
               <AlertTitle>当前不在评价填写时间范围内</AlertTitle>
               <AlertDescription>
                 {fillTimeSettings && fillTimeSettings.mode === 'specified'
                   ? `允许填写时间：${new Date(fillTimeSettings.start).toLocaleString('zh-CN')} 至 ${new Date(fillTimeSettings.end).toLocaleString('zh-CN')}`
                   : '请等待管理员开放填写时间后再操作。'}
               </AlertDescription>
             </Alert>
           )}

            {/* 学生身份已有记录状态提示（新建模式下） */}
            {hasStudentIdentity && !editId && myRecord && myRecord.reviewStatus === 'pending' && (
             <Alert variant="default" className="mb-4 border-blue-300 bg-blue-50">
               <Clock className="size-4 text-blue-600" />
               <AlertTitle className="text-blue-800">
                 您已提交过评价，当前状态：待审查
               </AlertTitle>
               <AlertDescription className="text-blue-700">
                 <div className="mt-1">如需修改，请等待审查结果；若被标记为待修改，可重新修改后提交。</div>
                 <Button
                   size="sm"
                   variant="outline"
                   className="mt-2 h-7 border-blue-400 text-blue-700 hover:bg-blue-100"
                   onClick={() => navigate(`/eval?id=${myRecord.id}&mode=view`)}
                 >
                   <Eye className="mr-1 h-3.5 w-3.5" />
                   查看已提交记录
                 </Button>
               </AlertDescription>
             </Alert>
           )}
            {hasStudentIdentity && !editId && myRecord && myRecord.reviewStatus === 'approved' && (
             <Alert variant="default" className="mb-4 border-emerald-300 bg-emerald-50">
               <Check className="size-4 text-emerald-600" />
               <AlertTitle className="text-emerald-800">
                 您已提交过评价，当前状态：已通过
               </AlertTitle>
               <AlertDescription className="text-emerald-700">
                 <div className="mt-1">评价记录已通过审查，不可再次提交。</div>
                 <Button
                   size="sm"
                   variant="outline"
                   className="mt-2 h-7 border-emerald-400 text-emerald-700 hover:bg-emerald-100"
                   onClick={() => navigate(`/eval?id=${myRecord.id}&mode=view`)}
                 >
                   <Eye className="mr-1 h-3.5 w-3.5" />
                   查看已通过记录
                 </Button>
               </AlertDescription>
             </Alert>
           )}

            {/* 待修改提示条 */}
            {recordStatus === 'needs_revision' && !resubmitted && (
              <Alert variant="warning" className="mb-4">
                <MessageSquareWarning className="size-4" />
                <AlertTitle>
                  本记录有 {needsRevisionItemList.length} 个指标待修改
                  <button
                    type="button"
                    onClick={() => setRevisionExpanded((prev) => !prev)}
                    className="ml-2 inline-flex items-center gap-1 text-sm font-normal underline underline-offset-2"
                  >
                    {revisionExpanded ? '收起详情' : '查看详情'}
                    {revisionExpanded ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                </AlertTitle>
                {revisionExpanded && (
                  <AlertDescription className="mt-2">
                    <ul className="space-y-1">
                      {needsRevisionItemList.map((item) => (
                        <li key={item.itemKey} className="flex gap-2">
                          <span className="font-medium text-amber-700 min-w-12">
                            · {item.itemName}：
                          </span>
                          <span>{item.comment || '（无具体意见）'}</span>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                )}
              </Alert>
            )}

            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="flex items-center gap-2">
              <label className="w-16 shrink-0 text-sm font-medium text-muted-foreground">
                学号
              </label>
               <Input
                 value={studentId}
                 onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                   setStudentId(e.target.value)
                 }
                 placeholder="请输入学号"
                  readOnly={pageReadOnly || Boolean(studentIdReadOnly)}
                />
             </div>
             <div className="flex items-center gap-2">
               <label className="w-16 shrink-0 text-sm font-medium text-muted-foreground">
                 班级
               </label>
                <Input
                  value={className}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setClassName(e.target.value)
                  }
                  placeholder="请输入班级"
                  readOnly={pageReadOnly}
                />
             </div>
             <div className="flex items-center gap-2">
               <label className="w-16 shrink-0 text-sm font-medium text-muted-foreground">
                 姓名
               </label>
                <Input
                  value={studentName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setStudentName(e.target.value)
                  }
                  placeholder="请输入姓名"
                  readOnly={pageReadOnly}
                />
            </div>

          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
            <table className="w-full min-w-[1200px] border-collapse text-center text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-700 text-white">
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '100px' }}>
                    学号
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '100px' }}>
                    班级
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '80px' }}>
                    姓名
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '120px' }}>
                    一级指标
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '130px' }}>
                    二级指标
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '45%' }}>
                    原因分值与证明文件
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold" style={{ width: '80px' }}>
                    各项分值
                  </th>
                  <th className="border border-slate-600 px-3 py-3 font-semibold bg-slate-600" style={{ width: '90px' }}>
                    类别总分
                  </th>
                  <th
                    className="sticky right-0 border border-slate-600 bg-slate-800 px-3 py-3 font-bold text-white shadow-[-2px_0_4px_rgba(0_0_0_0.15)]"
                    style={{ width: '100px' }}
                  >
                    总分
                  </th>
                </tr>
              </thead>
              <tbody>
                 {categories.map((cat: EvalCategory, catIdx: number) =>
                   cat.items.map((item: EvalItem, itemIdx: number) => {
                     const isFirstItemOfCat = itemIdx === 0;
                     const isFirstRow = catIdx === 0 && itemIdx === 0;
                     const rowIndex = catStartIndices[catIdx] + itemIdx;
                     const isEvenRow = rowIndex % 2 === 1;
                     const itemScore = computeItemScore(item, item.itemKey, item.itemMaxScore);
                     const catScore = computeCategoryScore(cat);
                     const isNegativeItem = itemScore < 0;
                     const isOverLimit =
                       item.itemMaxScore !== undefined &&
                       item.itemMaxScore > 0 &&
                       itemScore > item.itemMaxScore;
                     const catOverLimit =
                       cat.categoryMaxScore !== undefined &&
                       cat.categoryMaxScore > 0 &&
                       catScore > cat.categoryMaxScore;
                     // 背景色优先级：超上限黄底 > 斑马纹灰底 > 白底
                     const rowBgClass = isOverLimit
                       ? 'bg-amber-50'
                       : isEvenRow
                         ? 'bg-slate-50'
                         : 'bg-white';
                     return (
                       <tr
                         key={item.itemKey}
                         className={`transition-colors ${rowBgClass} hover:bg-blue-100/60`}
                       >
                        {isFirstRow && (
                          <>
                            <td
                              rowSpan={totalRows}
                              className="border border-slate-200 bg-slate-50 px-3 py-3 align-middle font-medium text-slate-700"
                            >
                              {studentId || '-'}
                            </td>
                            <td
                              rowSpan={totalRows}
                              className="border border-slate-200 bg-slate-50 px-3 py-3 align-middle font-medium text-slate-700"
                            >
                              {className || '-'}
                            </td>
                            <td
                              rowSpan={totalRows}
                              className="border border-slate-200 bg-slate-50 px-3 py-3 align-middle font-medium text-slate-700"
                            >
                              {studentName || '-'}
                            </td>
                          </>
                        )}
                        {isFirstItemOfCat && (
                          <td
                            rowSpan={cat.items.length}
                            className="border border-slate-200 bg-slate-100 px-3 py-3 align-middle font-bold text-slate-800"
                          >
                            {cat.categoryName}
                          </td>
                        )}
                          <td
                            className={`border border-slate-200 px-3 py-3 align-middle font-medium ${
                              isNegativeItem
                                ? 'text-rose-600'
                                : isItemNeedsRevision(item.itemKey)
                                  ? 'text-rose-700 bg-rose-50/50'
                                  : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {item.itemName}
                              {isItemNeedsRevision(item.itemKey) && (
                                <Badge variant="outline" className="border-rose-300 text-rose-600 bg-rose-50 text-xs">
                                  <MessageSquareWarning className="mr-1 size-3" />
                                  待修改
                                </Badge>
                              )}
                            </div>
                          </td>
                         <td className="border border-slate-200 px-3 py-3 align-top text-left">
                             <EvalReasonsCell
                               itemKey={item.itemKey}
                               itemMaxScore={item.itemMaxScore}
                               studentId={studentId}
                               studentName={studentName}
                               itemName={item.itemName}
                               reasons={item.reasons}
                               onReasonsChange={(reasons: EvalReason[]) =>
                                 handleReasonsChange(
                                   cat.categoryKey,
                                   item.itemKey,
                                   reasons,
                                 )
                               }
                               readOnly={pageReadOnly}
                              />
                         </td>
                          <td
                            className={`border border-slate-200 px-3 py-3 align-middle font-bold ${
                              itemScore < item.itemMaxScore
                                ? 'text-slate-700'
                                : isOverLimit
                                  ? 'text-amber-700'
                                  : 'text-emerald-600'
                            }`}
                          >
                            <span className="text-base">{itemScore}</span>
                            {BASE_SCORE_ITEMS[item.itemKey] ? (
                              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                                基础分{BASE_SCORE_ITEMS[item.itemKey]}分
                              </div>
                            ) : null}
                            {isOverLimit && (
                              <div className="mt-0.5 text-[10px] font-medium text-amber-600">
                                超上限
                              </div>
                            )}
                          </td>
                        {isFirstItemOfCat && (
                           <td
                             rowSpan={cat.items.length}
                             className={`border border-slate-200 bg-slate-100 px-3 py-3 align-middle font-bold ${
                               catOverLimit ? 'text-amber-700' : 'text-slate-800'
                             }`}
                           >
                             {catScore}
                             {catOverLimit && (
                               <div className="mt-0.5 text-[10px] font-medium text-amber-600">
                                 超上限
                               </div>
                             )}
                           </td>
                        )}
                        {isFirstRow && (
                          <td
                            rowSpan={totalRows}
                            className="sticky right-0 border border-slate-300 bg-slate-800 px-3 py-3 align-middle text-xl font-bold text-white shadow-[-2px_0_4px_rgba(0_0_0_0.15)]"
                          >
                            {totalScore}
                          </td>
                        )}
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

           <div className="mt-6 flex justify-center gap-3">
             {!pageReadOnly && (
               <Button
                 onClick={handleSubmit}
                 disabled={submitting}
                 size="lg"
                 className="min-w-40"
               >
                 {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit
                    ? recordStatus === 'needs_revision'
                      ? '保存修改并重新提交'
                      : '保存修改'
                    : '提交评价'}
               </Button>
             )}
             {pageReadOnly && (
               <Button variant="outline" size="lg" onClick={() => navigate(-1)}>
                 返回列表
               </Button>
             )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityEvalPage;

