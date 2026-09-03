import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { Loader2, Search, Calendar, History } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { authApi } from '@client/src/api';
import type { OperationLog } from '@shared/api.interface';

const ACTION_LABELS: Record<string, string> = {
  submit_eval: '提交评价',
  update_eval: '修改评价',
  review_approve: '审核通过',
  review_reject: '驳回',
  review_needs_revision: '标记待修改',
  delete_eval: '删除记录',
  admin_update_other: '管理员修改他人数据',
  role_change: '角色变更',
  user_create: '创建用户',
  user_delete: '删除用户',
};

const ACTION_COLORS: Record<string, string> = {
  submit_eval: 'bg-green-100 text-green-700',
  update_eval: 'bg-blue-100 text-blue-700',
  review_approve: 'bg-emerald-100 text-emerald-700',
  review_reject: 'bg-red-100 text-red-700',
  review_needs_revision: 'bg-amber-100 text-amber-700',
  delete_eval: 'bg-rose-100 text-rose-700',
  admin_update_other: 'bg-purple-100 text-purple-700',
  role_change: 'bg-indigo-100 text-indigo-700',
  user_create: 'bg-teal-100 text-teal-700',
  user_delete: 'bg-pink-100 text-pink-700',
};

const ROLE_LABELS: Record<string, string> = {
  student: '学生',
  admin: '管理员',
  super_admin: '超级管理员',
};

const OperationLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [operationType, setOperationType] = useState('');
  const [operatorStudentId, setOperatorStudentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadLogs = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await authApi.listLogs({
        page,
        pageSize,
        operationType: operationType || undefined,
        operatorStudentId: operatorStudentId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      logger.error(`加载操作日志失败: ${String(err)}`);
      toast.error('加载操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page]);

  const handleSearch = (): void => {
    setPage(1);
    loadLogs();
  };

  const handleReset = (): void => {
    setOperationType('');
    setOperatorStudentId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setTimeout(loadLogs, 0);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            操作日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">操作类型</label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">操作人学号</label>
              <Input
                value={operatorStudentId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setOperatorStudentId(e.target.value)
                }
                placeholder="学号"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">开始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStartDate(e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEndDate(e.target.value)
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch}>
                <Search className="mr-1 h-4 w-4" />
                查询
              </Button>
              <Button variant="outline" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '170px' }}>时间</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead style={{ width: '90px' }}>角色</TableHead>
                    <TableHead style={{ width: '120px' }}>操作类型</TableHead>
                    <TableHead style={{ width: '100px' }}>操作对象</TableHead>
                    <TableHead>操作详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: OperationLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.createdAt}
                        </TableCell>
                        <TableCell className="font-medium">
                          {log.operatorName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({log.operatorStudentId})
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ROLE_LABELS[log.operatorRole] || log.operatorRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={ACTION_COLORS[log.operationType] || ''}
                          >
                            {ACTION_LABELS[log.operationType] || log.operationType}
                          </Badge>
                        </TableCell>
                         <TableCell className="text-sm">
                           {log.targetStudentName || '-'}
                         </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.detail}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {total > pageSize && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    第 {page} / {totalPages} 页，共 {total} 条
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OperationLogsPage;
