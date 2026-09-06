import type {
  EvalCategory,
  EvalItem,
  QualityEvalRecord,
} from '@shared/api.interface';

export const BASE_SCORE_ITEMS: Record<string, number> = {
  'law-abiding': 5,
  'physical-health': 5,
  'civilized': 5,
};

export const ITEM_MAX_SCORES: Record<string, number> = {
  'ideological-politics': 10,
  'moral': 5,
  'law-abiding': 5,
  'learning-attitude': 5,
  'innovation': 15,
  'physical-health': 5,
  'sports-activity': 15,
  'civilized': 5,
  'art-practice': 15,
  'labor-quality': 10,
  'labor-practice': 10,
  'social-work': 10,
  'college-special': 10,
};

export const CATEGORY_MAX_SCORES: Record<string, number> = {
  ideological: 20,
  academic: 20,
  sports: 20,
  arts: 20,
  labor: 20,
  expansion: 20,
};

interface CategoryTemplate {
  categoryKey: string;
  categoryName: string;
  isExtra?: boolean;
  items: Array<{ itemKey: string; itemName: string }>;
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    categoryKey: 'ideological',
    categoryName: '思想道德素质',
    items: [
      { itemKey: 'ideological-politics', itemName: '思想政治' },
      { itemKey: 'moral', itemName: '道德素养' },
      { itemKey: 'law-abiding', itemName: '遵纪守法' },
    ],
  },
  {
    categoryKey: 'academic',
    categoryName: '学创素质',
    items: [
      { itemKey: 'learning-attitude', itemName: '学习态度' },
      { itemKey: 'innovation', itemName: '学科创新' },
    ],
  },
  {
    categoryKey: 'sports',
    categoryName: '体育素质',
    items: [
      { itemKey: 'physical-health', itemName: '体质健康' },
      { itemKey: 'sports-activity', itemName: '体育活动' },
    ],
  },
  {
    categoryKey: 'arts',
    categoryName: '美育素质',
    items: [
      { itemKey: 'civilized', itemName: '文明素养' },
      { itemKey: 'art-practice', itemName: '文艺实践' },
    ],
  },
  {
    categoryKey: 'labor',
    categoryName: '劳动素质',
    items: [
      { itemKey: 'labor-quality', itemName: '劳动品质' },
      { itemKey: 'labor-practice', itemName: '劳动实践' },
    ],
  },
  {
    categoryKey: 'expansion',
    categoryName: '素质拓展',
    isExtra: true,
    items: [
      { itemKey: 'social-work', itemName: '社会工作' },
      { itemKey: 'college-special', itemName: '学院专项管理' },
    ],
  },
];

export function buildInitialCategories(): EvalCategory[] {
  return CATEGORY_TEMPLATES.map((c: CategoryTemplate) => ({
    categoryKey: c.categoryKey,
    categoryName: c.categoryName,
    categoryScore: 0,
    categoryMaxScore: CATEGORY_MAX_SCORES[c.categoryKey],
    isExtra: c.isExtra,
    items: c.items.map((it) => ({
      itemKey: it.itemKey,
      itemName: it.itemName,
      itemScore: 0,
      itemMaxScore: ITEM_MAX_SCORES[it.itemKey],
      reasons: [],
    })),
  }));
}

export function getTotalRows(cats: EvalCategory[]): number {
  return cats.reduce((sum: number, c: EvalCategory) => sum + c.items.length, 0);
}

export function computeItemScore(
  item: { reasons: Array<{ score?: number }> },
  itemKey?: string,
): number {
  const raw: number = item.reasons.reduce(
    (s: number, r: { score?: number }) => s + (Number(r.score) || 0),
    0,
  );
  const base: number = itemKey ? BASE_SCORE_ITEMS[itemKey] ?? 0 : 0;
  return Math.max(0, raw + base);
}

export function computeCategoryScore(cat: EvalCategory): number {
  return cat.items.reduce(
    (s: number, item: EvalItem) => s + computeItemScore(item, item.itemKey),
    0,
  );
}

export function computeQualityScore(cats: EvalCategory[]): number {
  const extraBonus = cats.reduce((sum: number, cat: EvalCategory) => {
    if (cat.categoryKey !== 'expansion') return sum;
    const catSum = cat.items.reduce((s: number, item: EvalItem) => {
      return s + item.reasons.reduce(
        (rSum: number, r: { score?: number }) => rSum + Math.max(0, Number(r.score) || 0),
        0,
      );
    }, 0);
    return sum + Math.min(catSum, 20);
  }, 0);
  const regularScore = cats.reduce((sum: number, cat: EvalCategory) => {
    if (cat.categoryKey === 'expansion') return sum;
    return sum + computeCategoryScore(cat);
  }, 0);
  return regularScore + extraBonus;
}

export function normalizeEvalRecordScores(record: QualityEvalRecord): QualityEvalRecord {
  const categories: EvalCategory[] = record.categories.map((cat: EvalCategory) => {
    const items: EvalItem[] = cat.items.map((item: EvalItem) => ({
      ...item,
      itemScore: computeItemScore(item, item.itemKey),
    }));
    return {
      ...cat,
      items,
      categoryScore: items.reduce(
        (s: number, it: EvalItem) => s + it.itemScore,
        0,
      ),
    };
  });
  return {
    ...record,
    categories,
    qualityScore: computeQualityScore(categories),
  };
}

export function getCatStartIndices(cats: EvalCategory[]): number[] {
  const starts: number[] = [];
  let count = 0;
  for (const cat of cats) {
    starts.push(count);
    count += cat.items.length;
  }
  return starts;
}
