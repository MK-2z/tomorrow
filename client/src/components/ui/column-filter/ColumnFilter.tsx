import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  ChevronDown,
  Search,
} from 'lucide-react';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@client/src/components/ui/popover';
import { Checkbox } from '@client/src/components/ui/checkbox';
import { logger } from '@/utils/logger';

export type SortOrder = 'asc' | 'desc' | null;

export interface ColumnFilterProps {
  title: string;
  field: string;
  sortOrder?: SortOrder;
  selectedValues: string[];
  onSortChange: (field: string, order: SortOrder) => void;
  onFilterChange: (field: string, values: string[]) => void;
  fetchValues: (field: string, keyword: string) => Promise<string[]>;
  valueLabelMap?: Record<string, string>;
  align?: 'left' | 'right' | 'center';
}

export const ColumnFilter: React.FC<ColumnFilterProps> = ({
  title,
  field,
  sortOrder = null,
  selectedValues,
  onSortChange,
  onFilterChange,
  fetchValues,
  valueLabelMap,
  align = 'left',
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [allValues, setAllValues] = useState<string[]>([]);
  const [draftValues, setDraftValues] = useState<string[]>([...selectedValues]);
  const [loading, setLoading] = useState(false);
  const openedRef = useRef(false);

  const hasFilter = selectedValues.length > 0;

  const handleToggleSort = () => {
    if (!sortOrder) {
      onSortChange(field, 'asc');
    } else if (sortOrder === 'asc') {
      onSortChange(field, 'desc');
    } else {
      onSortChange(field, null);
    }
  };

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    setDraftValues([...selectedValues]);
    setKeyword('');
    setLoading(true);
    fetchValues(field, '')
      .then((values: string[]) => {
        setAllValues(values);
      })
      .catch((err: unknown) => {
        logger.error(`获取列${field}可选值失败`, err);
        setAllValues([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, field, fetchValues, selectedValues]);

  const handleSearch = (val: string) => {
    setKeyword(val);
    if (!val.trim()) {
      setLoading(true);
      fetchValues(field, '')
        .then((values: string[]) => {
          setAllValues(values);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }
    setLoading(true);
    fetchValues(field, val)
      .then((values: string[]) => {
        setAllValues(values);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const displayValues = allValues;

  const toggleValue = (value: string) => {
    setDraftValues((prev: string[]) => {
      if (prev.includes(value)) {
        return prev.filter((v: string) => v !== value);
      }
      return [...prev, value];
    });
  };

  const toggleAll = () => {
    if (draftValues.length === displayValues.length && displayValues.length > 0) {
      setDraftValues([]);
    } else {
      setDraftValues([...displayValues]);
    }
  };

  const handleApply = () => {
    onFilterChange(field, draftValues);
    setOpen(false);
  };

  const handleClear = () => {
    setDraftValues([]);
    onFilterChange(field, []);
    setOpen(false);
  };

  const getLabel = (value: string): string => {
    if (valueLabelMap && valueLabelMap[value]) return valueLabelMap[value];
    return value;
  };

  const alignClass =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
        ? 'justify-center'
        : 'justify-start';

  return (
    <div className={`flex w-full items-center gap-1 ${alignClass}`}>
      <button
        type="button"
        onClick={handleToggleSort}
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent"
        title={
          !sortOrder ? '升序' : sortOrder === 'asc' ? '降序' : '取消排序'
        }
      >
        {sortOrder === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : sortOrder === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
        )}
      </button>
      <span className="flex-1 truncate text-xs font-medium text-foreground">
        {title}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent ${hasFilter ? 'text-primary' : 'text-muted-foreground/70'}`}
            title="筛选"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="start">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                size={24}
                value={keyword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleSearch(e.target.value)
                }
                placeholder="搜索值"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={
                    displayValues.length > 0 &&
                    draftValues.length === displayValues.length
                  }
                  onCheckedChange={toggleAll}
                />
                全选
              </label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={handleClear}
              >
                清除
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto border rounded-md">
              {loading && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  加载中...
                </div>
              )}
              {!loading && displayValues.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  无可选项
                </div>
              )}
              {!loading &&
                displayValues.map((value: string) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      checked={draftValues.includes(value)}
                      onCheckedChange={() => toggleValue(value)}
                    />
                    <span className="truncate">{getLabel(value)}</span>
                  </label>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleApply}>
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ColumnFilter;
