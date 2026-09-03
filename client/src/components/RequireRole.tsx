import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';

import { useAuth } from '@client/src/contexts/AuthContext';
import type { UserRole } from '@shared/api.interface';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!roles.includes(currentUser.role)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Lock className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">无权限访问</h2>
            <p className="text-center text-sm text-muted-foreground">
              您当前的角色（{currentUser.role}）无权访问此页面。
              <br />
              如需访问，请联系管理员。
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              返回上一页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireRole;
