import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FileText,
  ListTodo,
  ClipboardCheck,
  History,
  Users,
  LogIn,
  LogOut,
  KeyRound,
  Clock,
} from 'lucide-react';

import { useAuth } from '@client/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ChangePasswordDialog from '@client/src/components/ChangePasswordDialog';

const ROLE_LABELS: Record<string, string> = {
  student: '学生',
  admin: '管理员（学生管理员）',
  super_admin: '超级管理员',
};

function getLoginPortal(): 'student' | 'teacher' {
  if (typeof window === 'undefined') return 'student';
  const v = localStorage.getItem('quality_eval_login_portal');
  return v === 'teacher' ? 'teacher' : 'student';
}

const Layout = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isTeacherPortal = getLoginPortal() === 'teacher';

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-semibold text-slate-900">
                素质评价分收集系统
              </h1>
            </div>
            <nav className="flex items-center gap-1">
               {currentUser && (
                 <>
                   {!isTeacherPortal && (
                     <>
                       <NavLink
                         to="/eval"
                         className={({ isActive }) =>
                           `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                             isActive
                               ? 'bg-primary/10 text-primary'
                               : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                           }`
                         }
                       >
                         <FileText className="h-4 w-4" />
                         评价填写
                       </NavLink>
                       <NavLink
                         to="/records"
                         className={({ isActive }) =>
                           `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                             isActive
                               ? 'bg-primary/10 text-primary'
                               : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                           }`
                         }
                       >
                         <ListTodo className="h-4 w-4" />
                         评价记录
                       </NavLink>
                     </>
                   )}
                   {isAdmin && (
                    <NavLink
                      to="/review"
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      审查工作台
                    </NavLink>
                  )}
                  {isSuperAdmin && isTeacherPortal && (
                    <NavLink
                      to="/logs"
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <History className="h-4 w-4" />
                      操作日志
                    </NavLink>
                  )}
                  {isSuperAdmin && (
                    <NavLink
                      to="/users"
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Users className="h-4 w-4" />
                      用户管理
                    </NavLink>
                  )}
                  {isSuperAdmin && (
                    <NavLink
                      to="/settings/fill-time"
                      className={({ isActive }) =>
                        `inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`
                      }
                    >
                      <Clock className="h-4 w-4" />
                      时间设置
                    </NavLink>
                  )}
                </>
              )}
            </nav>
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-slate-900">
                      {currentUser.displayName || currentUser.studentId}
                    </span>
                    <span className="text-xs text-slate-500">
                      {currentUser.studentId}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {ROLE_LABELS[currentUser.role] || currentUser.role}
                  </Badge>
                  <ChangePasswordDialog
                    trigger={
                      <Button variant="outline" size="sm" title="修改密码">
                        <KeyRound className="h-3 w-3" />
                        <span className="sr-only">修改密码</span>
                      </Button>
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-1 h-3 w-3" />
                    退出登录
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                  <LogIn className="mr-1 h-3 w-3" />
                  登录
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
