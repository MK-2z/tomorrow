import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Loader2,
  LogIn,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { logger } from '@/utils/logger';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import loginBg from '@/assets/images/login-bg.jpg';

import { useAuth } from '@client/src/contexts/AuthContext';
import { hasRole } from '@client/src/contexts/AuthContext';

type LoginType = 'student' | 'teacher';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [loginType, setLoginType] = useState<LoginType>('student');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [teacherAccount, setTeacherAccount] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const handleStudentSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error('请输入学号');
      return;
    }
    if (!password.trim()) {
      toast.error('请输入密码');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(studentId.trim(), password, 'student');
      toast.success('登录成功');
      let target = '/eval';
      if (user.role === 'admin' || user.role === 'super_admin') {
        target = '/review';
      }
      if (from) {
        // 已登录跳转来源页时，仅当来源页不是根路径才使用来源页
        target = from !== '/' ? from : target;
      }
      navigate(target, { replace: true });
    } catch (err) {
      logger.error(`学生登录失败: ${String(err)}`);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        '学号或密码错误';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!teacherAccount.trim()) {
      toast.error('请输入教师账号');
      return;
    }
    if (!teacherPassword.trim()) {
      toast.error('请输入密码');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(teacherAccount.trim(), teacherPassword, 'teacher');
      if (user.role !== 'super_admin') {
        toast.error('该账号无教师端口登录权限，请联系超级管理员');
        setSubmitting(false);
        return;
      }
      toast.success('登录成功');
      const target = from && !from.startsWith('/eval') && from !== '/' ? from : '/review';
      navigate(target, { replace: true });
    } catch (err) {
      logger.error(`教师登录失败: ${String(err)}`);
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        '账号或密码错误';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 sm:justify-start sm:pl-[12%]"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: '70% center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <Card className="relative z-10 w-full max-w-md border-white/30 bg-white/50 shadow-2xl backdrop-blur-3xl">
        <CardHeader className="pb-4 text-center">
          <CardTitle className="text-lg font-bold leading-tight text-slate-800 sm:text-xl">
            集美大学轮机工程学院
          </CardTitle>
          <CardTitle className="mt-1 text-base font-semibold text-slate-700 sm:text-lg">
            学生素质评价系统
          </CardTitle>
          <p className="mt-2 text-sm text-slate-500">请选择登录方式</p>
        </CardHeader>
        <CardContent>
          <Tabs value={loginType} onValueChange={(v: string) => setLoginType(v as LoginType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="student" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                学生登录
              </TabsTrigger>
              <TabsTrigger value="teacher" className="gap-2">
                 <ShieldCheck className="h-4 w-4" />
                 教师登录
               </TabsTrigger>
            </TabsList>

            <TabsContent value="student">
              <form onSubmit={handleStudentSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">学号</Label>
                  <Input
                    id="studentId"
                    type="text"
                    value={studentId}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setStudentId(e.target.value)
                    }
                    placeholder="请输入学号"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentPassword">密码</Label>
                  <Input
                    id="studentPassword"
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setPassword(e.target.value)
                    }
                    placeholder="请输入密码（初始密码123456）"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                  {submitting ? '登录中...' : '学生登录'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  首次登录请使用学号和初始密码 123456，系统将自动创建账户
                </p>
              </form>
            </TabsContent>

            <TabsContent value="teacher">
              <form onSubmit={handleTeacherSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teacherAccount">教师账号</Label>
                  <Input
                    id="teacherAccount"
                    type="text"
                    value={teacherAccount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTeacherAccount(e.target.value)
                    }
                    placeholder="请输入教师/管理员账号"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherPassword">密码</Label>
                  <Input
                    id="teacherPassword"
                    type="password"
                    value={teacherPassword}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTeacherPassword(e.target.value)
                    }
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={submitting}
                  variant="secondary"
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="mr-2 h-4 w-4" />
                  )}
                   {submitting ? '登录中...' : '教师登录'}
                </Button>
                 <p className="text-center text-xs text-muted-foreground">
                   教师登录端口（仅超级管理员）
                 </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
