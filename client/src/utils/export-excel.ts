import XLSX from 'xlsx-js-style';
import { normalizeEvalRecordScores, CATEGORY_TEMPLATES } from '@client/src/pages/quality-eval/evalCategories';
import type {
  QualityEvalRecord,
  EvalCategory,
  EvalItem,
  EvalReason,
} from '@shared/api.interface';

const BASE_COL_WIDTHS = [
  { wch: 14 }, // A 学号
  { wch: 10 }, // B (学号合并列)
  { wch: 12 }, // C 班级
  { wch: 10 }, // D 姓名
  { wch: 12 }, // E 一级指标
  { wch: 12 }, // F 二级指标
  { wch: 8 },  // G
  { wch: 8 },  // H
  { wch: 8 },  // I
  { wch: 8 },  // J
  { wch: 8 },  // K
  { wch: 8 },  // L
  { wch: 8 },  // M 原因分值(G-M共7列)
  { wch: 10 }, // N 各项分值
  { wch: 10 }, // O 类别总分
  { wch: 10 }, // P 总分
  { wch: 10 }, // Q (总分合并列)
];

const HEADER_STYLE = {
  font: { bold: true, name: '宋体', sz: 11, color: { rgb: '000000' } },
  fill: { fgColor: { rgb: 'D9E1F2' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const SUB_HEADER_STYLE = {
  font: { bold: false, name: '宋体', sz: 11, color: { rgb: '000000' } },
  fill: { fgColor: { rgb: 'E2EFDA' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const CAT_STYLE = {
  font: { bold: true, name: '宋体', sz: 11, color: { rgb: '000000' } },
  fill: { fgColor: { rgb: 'FFF2CC' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const CELL_STYLE = {
  font: { name: '宋体', sz: 10, color: { rgb: '000000' } },
  alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const CENTER_STYLE = {
  font: { name: '宋体', sz: 11, color: { rgb: '000000' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const TOTAL_STYLE = {
  font: { bold: true, name: '宋体', sz: 12, color: { rgb: 'C00000' } },
  fill: { fgColor: { rgb: 'FCE4D6' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

const SCORE_STYLE = {
  font: { bold: true, name: '宋体', sz: 11, color: { rgb: '000000' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
};

function formatReasonText(reason: EvalReason): string {
  const parts: string[] = [];
  const projectName = reason.projectName || reason.reason || '';
  const levelName = reason.levelName || reason.optionName || '';
  const score = Number(reason.score) || 0;
  const count = reason.count ?? 1;
  if (projectName && levelName) {
    parts.push(`${projectName}（${levelName}）`);
  } else if (projectName) {
    parts.push(projectName);
  } else if (levelName) {
    parts.push(levelName);
  }
  if (count > 1) {
    parts.push(`×${count}次`);
  }
  if (score !== 0) {
    parts.push(`（${score > 0 ? '+' : ''}${score}分）`);
  }
  return parts.join('');
}

function setCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  value: string | number,
  style?: unknown,
): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  ws[addr] = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: style as never,
  };
}

function mergeRange(
  ws: XLSX.WorkSheet,
  sr: number,
  sc: number,
  er: number,
  ec: number,
): void {
  if (!ws['!merges']) ws['!merges'] = [];
  (
    ws['!merges'] as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
  ).push({
    s: { r: sr, c: sc },
    e: { r: er, c: ec },
  });
}

function buildItemRowsCount(): number {
  return CATEGORY_TEMPLATES.reduce(
    (sum: number, cat: { items: unknown[] }) => sum + cat.items.length,
    0,
  );
}

export function exportToExcel(
  records: QualityEvalRecord[],
  fileName?: string,
): void {
  if (!records || records.length === 0) {
    return;
  }

  const normalized = records.map((r: QualityEvalRecord) =>
    normalizeEvalRecordScores(r),
  );

  const totalItemRows = buildItemRowsCount(); // 13
  const ws: XLSX.WorkSheet = {};
  ws['!cols'] = BASE_COL_WIDTHS;

  // 列索引定义
  const COL = {
    STUDENT_ID_A: 0,
    STUDENT_ID_B: 1,
    CLASS: 2,
    NAME: 3,
    CATEGORY: 4,
    ITEM: 5,
    REASON_START: 6,
    REASON_END: 12,
    ITEM_SCORE: 13,
    CAT_TOTAL: 14,
    TOTAL_P: 15,
    TOTAL_Q: 16,
  };

  // ===== 第0行：表头 =====
  // 学号（A-B 合并）
  setCell(ws, 0, COL.STUDENT_ID_A, '学号', HEADER_STYLE);
  setCell(ws, 0, COL.STUDENT_ID_B, '', HEADER_STYLE);
  mergeRange(ws, 0, COL.STUDENT_ID_A, 0, COL.STUDENT_ID_B);

  // 班级
  setCell(ws, 0, COL.CLASS, '班级', HEADER_STYLE);

  // 姓名
  setCell(ws, 0, COL.NAME, '姓名', HEADER_STYLE);

  // 一级指标
  setCell(ws, 0, COL.CATEGORY, '一级指标', HEADER_STYLE);

  // 二级指标
  setCell(ws, 0, COL.ITEM, '二级指标', HEADER_STYLE);

  // 原因分值（G-M 7列合并）
  setCell(ws, 0, COL.REASON_START, '原因分值', HEADER_STYLE);
  for (let c = COL.REASON_START + 1; c <= COL.REASON_END; c += 1) {
    setCell(ws, 0, c, '', HEADER_STYLE);
  }
  mergeRange(ws, 0, COL.REASON_START, 0, COL.REASON_END);

  // 各项分值
  setCell(ws, 0, COL.ITEM_SCORE, '各项分值', HEADER_STYLE);

  // 类别总分
  setCell(ws, 0, COL.CAT_TOTAL, '类别总分', HEADER_STYLE);

  // 总分（P-Q 合并）
  setCell(ws, 0, COL.TOTAL_P, '总分', TOTAL_STYLE);
  setCell(ws, 0, COL.TOTAL_Q, '', TOTAL_STYLE);
  mergeRange(ws, 0, COL.TOTAL_P, 0, COL.TOTAL_Q);

  // ===== 第1行起：各学生数据（每个学生占 totalItemRows 行） =====
  let rowCursor = 1;

  for (const record of normalized) {
    const recordStartRow = rowCursor;
    const recordEndRow = rowCursor + totalItemRows - 1;

    // 学号（A-B 两列水平合并 + 纵向贯穿整个学生）
    for (let r = recordStartRow; r <= recordEndRow; r += 1) {
      setCell(ws, r, COL.STUDENT_ID_A, '', CENTER_STYLE);
      setCell(ws, r, COL.STUDENT_ID_B, '', CENTER_STYLE);
    }
    setCell(ws, recordStartRow, COL.STUDENT_ID_A, record.studentId, CENTER_STYLE);
    mergeRange(ws, recordStartRow, COL.STUDENT_ID_A, recordEndRow, COL.STUDENT_ID_B);

    // 班级
    setCell(ws, rowCursor, COL.CLASS, record.className, CENTER_STYLE);

    // 姓名
    setCell(ws, rowCursor, COL.NAME, record.studentName, CENTER_STYLE);

    // 总分（P-Q 两列水平合并 + 纵向贯穿整个学生）
    const qualityScore = Number(record.qualityScore) || 0;
    for (let r = recordStartRow; r <= recordEndRow; r += 1) {
      setCell(ws, r, COL.TOTAL_P, '', TOTAL_STYLE);
      setCell(ws, r, COL.TOTAL_Q, '', TOTAL_STYLE);
    }
    setCell(ws, recordStartRow, COL.TOTAL_P, qualityScore, TOTAL_STYLE);
    mergeRange(ws, recordStartRow, COL.TOTAL_P, recordEndRow, COL.TOTAL_Q);

    // 按模板顺序填充每个指标行
    let itemRow = 0;
    for (const tplCat of CATEGORY_TEMPLATES) {
      const cat = record.categories.find(
        (c: EvalCategory) => c.categoryKey === tplCat.categoryKey,
      );
      const catStartRow = rowCursor + itemRow;
      const catItemCount = tplCat.items.length;
      const catEndRow = catStartRow + catItemCount - 1;

      // 一级指标列（纵向合并该类别下的所有二级指标行）
      setCell(ws, catStartRow, COL.CATEGORY, tplCat.categoryName, CAT_STYLE);
      if (catItemCount > 1) {
        mergeRange(ws, catStartRow, COL.CATEGORY, catEndRow, COL.CATEGORY);
      }

      // 类别总分（纵向合并）
      const catScore = cat ? Number(cat.categoryScore) || 0 : 0;
      setCell(ws, catStartRow, COL.CAT_TOTAL, catScore, SCORE_STYLE);
      if (catItemCount > 1) {
        mergeRange(ws, catStartRow, COL.CAT_TOTAL, catEndRow, COL.CAT_TOTAL);
      }

      // 二级指标逐行
      for (const tplItem of tplCat.items) {
        const curRow = rowCursor + itemRow;
        const item = cat?.items.find(
          (it: EvalItem) => it.itemKey === tplItem.itemKey,
        );

        // 二级指标名
        setCell(ws, curRow, COL.ITEM, tplItem.itemName, SUB_HEADER_STYLE);

        // 原因分值（G-M 7列合并展示原因文本）
        const reasons = item?.reasons ?? [];
        let reasonText = '';
        if (reasons.length === 0) {
          reasonText = '';
        } else {
          reasonText = reasons
            .map((r: EvalReason, idx: number) => `${idx + 1}. ${formatReasonText(r)}`)
            .join('\n');
        }
        setCell(ws, curRow, COL.REASON_START, reasonText, CELL_STYLE);
        for (let c = COL.REASON_START + 1; c <= COL.REASON_END; c += 1) {
          setCell(ws, curRow, c, '', CELL_STYLE);
        }
        mergeRange(ws, curRow, COL.REASON_START, curRow, COL.REASON_END);

        // 各项分值
        const itemScore = item ? Number(item.itemScore) || 0 : 0;
        setCell(ws, curRow, COL.ITEM_SCORE, itemScore, SCORE_STYLE);

        itemRow += 1;
      }
    }

    // 行高估算
    if (!ws['!rows']) ws['!rows'] = [];
    for (let i = 0; i < totalItemRows; i += 1) {
      const curRow = rowCursor + i;
      // 根据原因条数估行高
      let maxReasonsInRow = 0;
      const catIdx = Math.floor(i / 1); // not used
      void catIdx;
      // 简单估算：每行原因条数
      const tplCat = findCategoryByItemIndex(i);
      if (tplCat) {
        const itemOffset = getItemOffsetInCategory(i);
        const tplItem = tplCat.items[itemOffset];
        const cat = record.categories.find(
          (c: EvalCategory) => c.categoryKey === tplCat.categoryKey,
        );
        const item = cat?.items.find(
          (it: EvalItem) => it.itemKey === tplItem.itemKey,
        );
        maxReasonsInRow = item?.reasons?.length ?? 0;
      }
      const rowH = Math.max(25, 20 + maxReasonsInRow * 18);
      (ws['!rows'] as Array<{ hpt: number }>)[curRow] = { hpt: rowH };
    }

    rowCursor += totalItemRows;
  }

  const lastRow = rowCursor - 1;
  const lastCol = COL.TOTAL_Q;
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastCol },
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '素质评价分');

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const exportName = fileName || `素质评价分_${y}${m}${d}.xlsx`;
  XLSX.writeFile(wb, exportName);
}

function findCategoryByItemIndex(
  idx: number,
): { categoryKey: string; items: { itemKey: string }[] } | null {
  let count = 0;
  for (const cat of CATEGORY_TEMPLATES) {
    if (idx < count + cat.items.length) {
      return cat as { categoryKey: string; items: { itemKey: string }[] };
    }
    count += cat.items.length;
  }
  return null;
}

function getItemOffsetInCategory(idx: number): number {
  let count = 0;
  for (const cat of CATEGORY_TEMPLATES) {
    if (idx < count + cat.items.length) {
      return idx - count;
    }
    count += cat.items.length;
  }
  return 0;
}

export function countEvalReasons(categories: EvalCategory[]): number {
  let total = 0;
  for (const cat of categories) {
    for (const item of cat.items) {
      total += (item.reasons?.length ?? 0) as number;
    }
  }
  return total;
}
