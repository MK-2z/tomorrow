import React, { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { Clock, Loader2, Save } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Button } from '@client/src/components/ui/button';
import {
  RadioGroup,
  RadioGroupItem,
} from '@client/src/components/ui/radio-group';
import { Label } from '@client/src/components/ui/label';
import { Input } from '@client/src/components/ui/input';

import {
  getFillTimeSettings,
  updateFillTimeSettings,
} from '@client/src/api/quality-eval';
import type { FillTimeSettings } from '@shared/api.interface';

function formatForDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFromDatetimeLocal(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

const FillTimeSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'always' | 'specified'>('always');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const data: FillTimeSettings = await getFillTimeSettings();
        setMode(data.mode);
        setStart(formatForDatetimeLocal(data.start));
        setEnd(formatForDatetimeLocal(data.end));
      } catch (error) {
        logger.error('加载填写时间设置失败', error);
        toast.error('加载失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    if (mode === 'specified') {
      if (!start) {
        toast.error('请选择开始时间');
        return;
      }
      if (!end) {
        toast.error('请选择结束时间');
        return;
      }
      if (new Date(start) >= new Date(end)) {
        toast.error('结束时间必须晚于开始时间');
        return;
      }
    }
    setSaving(true);
    try {
      await updateFillTimeSettings({
        mode,
        start: mode === 'specified' ? formatFromDatetimeLocal(start) : undefined,
        end: mode === 'specified' ? formatFromDatetimeLocal(end) : undefined,
      });
      toast.success('保存成功');
    } catch (error) {
      logger.error('保存填写时间设置失败', error);
      toast.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">加载中...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Clock className="h-5 w-5" />
            填写时间设置
          </CardTitle>
          <CardDescription>
            设置学生端素质评价的允许填写时间段
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">填写模式</Label>
            <RadioGroup
              value={mode}
              onValueChange={(value: string) =>
                setMode(value as 'always' | 'specified')
              }
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 rounded-md border p-3">
                <RadioGroupItem value="always" id="mode-always" />
                <Label htmlFor="mode-always" className="cursor-pointer flex-1">
                  <div className="font-medium">始终允许填写</div>
                  <div className="text-sm text-muted-foreground">
                    学生可随时提交或修改素质评价
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-md border p-3">
                <RadioGroupItem value="specified" id="mode-specified" />
                <Label
                  htmlFor="mode-specified"
                  className="cursor-pointer flex-1"
                >
                  <div className="font-medium">指定时间段</div>
                  <div className="text-sm text-muted-foreground">
                    仅在设定的时间段内允许填写评价
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'specified' && (
            <div className="grid grid-cols-1 gap-4 rounded-md border p-4 bg-muted/30 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fill-start">开始时间</Label>
                <Input
                  id="fill-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setStart(e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fill-end">结束时间</Label>
                <Input
                  id="fill-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEnd(e.target.value)
                  }
                />
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FillTimeSettingsPage;
