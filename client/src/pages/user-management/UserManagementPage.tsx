import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { Loader2, Plus, UserPlus, Trash2, Shield, ShieldOff, Search, RotateCcw, CheckSquare } from 'lucide-react';
import { showConfirm } from '@/compat';

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { authApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import type { QualityEvalUser, UserRole } from '@shared/api.interface';

const ROLE_LABELS: Record<UserRole, string> = {
  student: '普通学生',
  admin: '学生管理员',
  super_admin: '超级管理员',
};

const ROLE_COLORS: Record<UserRole, string> = {
  student: 'bg-slate-100 text-slate-700',
  admin: 'bg-blue-100 text-blue-700',
  super_admin: 'bg-purple-100 text-purple-700',
};

const ROLE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部' },
  { value: 'student', label: '普通学生' },
  { value: 'admin', label: '学生管理员' },
  { value: 'super_admin', label: '超级管理员' },
];

const UserManagementPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<QualityEvalUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [keyword, setKeyword] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [creating, setCreating] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const loadUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await authApi.listUsers({
        page,
        pageSize,
        role: roleFilter || undefined,
        keyword: keyword || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (err) {
      logger.error(`加载用户列表失败: ${String(err)}`);
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, keyword, roleFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, keyword, roleFilter, users.length]);

  const handleSearch = (): void => {
    setKeyword(searchInput.trim());
    setPage(1);
  };

  const handleReset = (): void => {
    setSearchInput('');
    setKeyword('');
    setRoleFilter('');
    setPage(1);
  };

  const handleCreateUser = async (): Promise<void> => {
    if (!newStudentId.trim() || !newPassword.trim() || !newName.trim() || !newClassName.trim()) {
      toast.error('请填写完整信息');
      return;
    }
    setCreating(true);
    try {
      await authApi.createUser({
        studentId: newStudentId.trim(),
        password: newPassword,
        className: newClassName.trim(),
        displayName: newName.trim(),
        role: newRole,
      });
      toast.success('创建用户成功');
      setDialogOpen(false);
      setNewStudentId('');
      setNewPassword('');
      setNewName('');
      setNewClassName('');
      setNewRole('student');
      loadUsers();
    } catch (err) {
      logger.error(`创建用户失败: ${String(err)}`);
      toast.error('创建用户失败');
    } finally {
      setCreating(false);
    }
  };

  const handleSetAdmin = async (user: QualityEvalUser): Promise<void> => {
    try {
      await authApi.updateUserRole(user.id, 'admin');
      toast.success('已设为管理员');
      loadUsers();
    } catch (err) {
      logger.error(`设置管理员失败: ${String(err)}`);
      toast.error('操作失败');
    }
  };

  const handleCancelAdmin = async (user: QualityEvalUser): Promise<void> => {
    try {
      await authApi.updateUserRole(user.id, 'student');
      toast.success('已取消管理员');
      loadUsers();
    } catch (err) {
      logger.error(`取消管理员失败: ${String(err)}`);
      toast.error('操作失败');
    }
  };

  const handleDelete = async (user: QualityEvalUser): Promise<void> => {
    const roleLabel = ROLE_LABELS[user.role] || user.role;
    if (!await showConfirm(`确定要删除用户 ${user.displayName || user.studentId}（${user.studentId}，${roleLabel}）吗？\n\n删除后该用户信息将被完全清除，需重新注册。`)) {
      return;
    }
    try {
      await authApi.deleteUser(user.id);
      toast.success('删除成功');
      loadUsers();
    } catch (err: unknown) {
      logger.error(`删除用户失败: ${String(err)}`);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '删除失败';
      toast.error(msg);
    }
  };

  const handleResetPassword = async (user: QualityEvalUser): Promise<void> => {
    if (!await showConfirm(`确定要重置用户 ${user.displayName || user.studentId}（${user.studentId}）的密码吗？\n\n重置后密码将变为默认密码 123456，该用户下次登录时需修改密码。`)) {
      return;
    }
    try {
      await authApi.resetPassword(user.id);
      toast.success('密码已重置为 123456');
    } catch (err: unknown) {
      logger.error(`重置密码失败: ${String(err)}`);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '重置密码失败';
      toast.error(msg);
    }
  };

  const selectableUsers = users.filter((u: QualityEvalUser) => u.role !== 'super_admin');
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((u: QualityEvalUser) => selectedIds.has(u.id));
  const someSelected = selectableUsers.some((u: QualityEvalUser) => selectedIds.has(u.id)) && !allSelected;

  const handleToggleAll = (checked: boolean): void => {
    if (checked) {
      const newSelected = new Set(selectedIds);
      for (const u of selectableUsers) {
        newSelected.add(u.id);
      }
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      for (const u of selectableUsers) {
        newSelected.delete(u.id);
      }
      setSelectedIds(newSelected);
    }
  };

  const handleToggleOne = (id: string, checked: boolean): void => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchDelete = async (): Promise<void> => {
    if (selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      const result = await authApi.batchDeleteUsers(Array.from(selectedIds));
      if (result.skippedSuperAdmin > 0) {
        toast.success(`已删除 ${result.deletedCount} 个用户，跳过 ${result.skippedSuperAdmin} 个超级管理员`);
      } else {
        toast.success(`已删除 ${result.deletedCount} 个用户`);
      }
      setBatchDeleteDialogOpen(false);
      setSelectedIds(new Set());
      loadUsers();
    } catch (err) {
      logger.error(`批量删除用户失败: ${String(err)}`);
      toast.error('批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  const selectedUsers = users.filter((u: QualityEvalUser) => selectedIds.has(u.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">用户管理</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              被设为管理员的学生从学生端口登录后可看到审查工作台等管理页面。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setBatchDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除
                <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
                  {selectedIds.size}
                </Badge>
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  添加用户
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>添加新用户</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">学号</label>
                    <Input
                      value={newStudentId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewStudentId(e.target.value)
                      }
                      placeholder="请输入学号"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">密码</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewPassword(e.target.value)
                      }
                      placeholder="请输入初始密码"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">姓名</label>
                    <Input
                      value={newName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewName(e.target.value)
                      }
                      placeholder="请输入姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">班级</label>
                    <Input
                      value={newClassName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewClassName(e.target.value)
                      }
                      placeholder="请输入班级"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">角色</label>
                    <Select value={newRole} onValueChange={(v: string) => setNewRole(v as UserRole)}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">普通学生</SelectItem>
                        <SelectItem value="admin">学生管理员</SelectItem>
                        <SelectItem value="super_admin">超级管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateUser} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {creating ? '创建中...' : '创建'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="搜索学号或姓名"
                  value={searchInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSearch}>
                搜索
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" />
                重置
              </Button>
            </div>
            <Tabs value={roleFilter || 'all'} onValueChange={(v: string) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-grid">
                {ROLE_FILTER_OPTIONS.map((opt: { value: string; label: string }) => (
                  <TabsTrigger key={opt.value || 'all'} value={opt.value || 'all'} className="text-xs sm:text-sm">
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {isSuperAdmin && selectedIds.size > 0 && (
            <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
              <span>
                <CheckSquare className="mr-2 inline h-4 w-4" />
                已选择 <span className="font-semibold">{selectedIds.size}</span> 人
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBatchDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                批量删除
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSuperAdmin && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={(checked: boolean) => handleToggleAll(checked)}
                          aria-label="全选"
                        />
                      </TableHead>
                    )}
                    <TableHead>学号</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>班级</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead align="right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user: QualityEvalUser) => {
                      const isSuperAdminUser = user.role === 'super_admin';
                      const disabled = isSuperAdminUser;
                      return (
                        <TableRow key={user.id} className={disabled ? 'opacity-70' : ''}>
                          {isSuperAdmin && (
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(user.id)}
                                onCheckedChange={(checked: boolean) => handleToggleOne(user.id, checked)}
                                disabled={disabled}
                                aria-label={`选择 ${user.studentId}`}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{user.studentId}</TableCell>
                          <TableCell>{user.displayName}</TableCell>
                          <TableCell>{user.className}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={ROLE_COLORS[user.role]}>
                              {ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <div className="flex justify-end gap-2">
                              {user.role === 'student' && isSuperAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSetAdmin(user)}
                                >
                                  <Shield className="mr-1 h-3 w-3" />
                                  设为管理员
                                </Button>
                              )}
                              {user.role === 'admin' && isSuperAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelAdmin(user)}
                                >
                                  <ShieldOff className="mr-1 h-3 w-3" />
                                  取消管理员
                                </Button>
                              )}
                              {isSuperAdmin && user.role !== 'super_admin' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResetPassword(user)}
                                >
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                  重置密码
                                </Button>
                              )}
                              {!disabled && isSuperAdmin && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(user)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  删除
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              {total > pageSize && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
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

      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除确认</DialogTitle>
            <DialogDescription>
              删除后用户信息将被完全清除，需重新注册。请确认以下操作。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="mb-3 text-sm text-muted-foreground">
              已选择 <span className="font-semibold text-foreground">{selectedUsers.length}</span> 个用户：
            </p>
            <div className="max-h-60 space-y-1.5 overflow-y-auto rounded-md border p-3 text-sm">
              {selectedUsers.map((u: QualityEvalUser) => (
                <div key={u.id} className="flex items-center justify-between">
                  <span className="font-medium">{u.studentId}</span>
                  <span className="text-muted-foreground">
                    {u.displayName || '-'}
                    <span className="mx-2 text-xs">·</span>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-amber-600">
              注意：超级管理员账号不可删除，已自动排除。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
              disabled={batchDeleting || selectedUsers.length === 0}
            >
              {batchDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
