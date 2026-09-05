import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff, ShieldAlert } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { changePassword } from '@client/src/api/auth';

interface ForceChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ForceChangePasswordDialogProps {
  open: boolean;
  onSuccess: () => void;
}

const ForceChangePasswordDialog = ({ open, onSuccess }: ForceChangePasswordDialogProps) => {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ForceChangePasswordFormValues>({
    defaultValues: {
      oldPassword: '123456',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ForceChangePasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: '两次输入的密码不一致',
      });
      return;
    }
    if (values.newPassword === '123456') {
      form.setError('newPassword', {
        type: 'manual',
        message: '新密码不能与初始密码相同',
      });
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(values.oldPassword, values.newPassword);
      toast.success('密码修改成功，请重新登录');
      form.reset();
      onSuccess();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || '密码修改失败，请重试';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <DialogTitle>首次登录，请修改密码</DialogTitle>
          </div>
          <DialogDescription>
            为了账户安全，首次登录必须修改初始密码。修改成功后请使用新密码重新登录。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="oldPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>当前密码（初始密码）</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      disabled
                      className="bg-muted"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              rules={{
                required: '请输入新密码',
                minLength: {
                  value: 6,
                  message: '新密码至少6位',
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNew ? 'text' : 'password'}
                        placeholder="请输入新密码（至少6位）"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-1"
                        onClick={() => setShowNew(!showNew)}
                        tabIndex={-1}
                      >
                        {showNew ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              rules={{
                required: '请再次输入新密码',
                validate: (value: string) =>
                  value === form.watch('newPassword') ||
                  '两次输入的密码不一致',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认新密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="请再次输入新密码"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-1"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <KeyRound className="mr-2 h-4 w-4 animate-spin" />
                    修改中...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    确认修改并重新登录
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ForceChangePasswordDialog;
