import React from 'react';
import type { EvalReason } from '@shared/api.interface';

interface ItemRemarksDisplayProps {
  reasons: EvalReason[];
}

const ItemRemarksDisplay: React.FC<ItemRemarksDisplayProps> = ({ reasons }) => {
  const remarks = reasons.filter(
    (r: EvalReason) => r.remark && r.remark.trim().length > 0,
  );
  if (remarks.length === 0) {
    return <span className="text-slate-400">-</span>;
  }
  return (
    <ul className="space-y-1">
      {remarks.map((r: EvalReason) => (
        <li key={r.id} className="leading-relaxed">
          <span className="font-bold text-amber-700">●</span>
          <span className="ml-1 font-semibold text-amber-800">
            {r.reason?.length > 10 ? `${r.reason.slice(0, 10)}…` : r.reason}
          </span>
          <span className="ml-1 text-slate-600">{r.remark}</span>
        </li>
      ))}
    </ul>
  );
};

export default ItemRemarksDisplay;
