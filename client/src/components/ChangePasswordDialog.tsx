import React from "react";
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { KeyRound, Eye, EyeOff } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

interface ChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordDialogProps {
  trigger?: React.ReactNode;
}

const ChangePasswordDialog = ({ trigger }: ChangePasswordDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordFormValues>({
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: ChangePasswordFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: '两次输入的密码不一致',
      });
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(values.oldPassword, values.newPassword);
      toast.success('密码修改成功');
      setOpen(false);
      form.reset();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || '密码修改失败，请重试';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <KeyRound className="mr-1 h-3 w-3" />
            修改密码
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>
            请输入旧密码和新密码，新密码至少6位。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="oldPassword"
              rules={{
                required: '请输入旧密码',
                minLength: {
                  value: 6,
                  message: '旧密码至少6位',
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>旧密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showOld ? 'text' : 'password'}
                        placeholder="请输入旧密码"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-1"
                        onClick={() => setShowOld(!showOld)}
                        tabIndex={-1}
                      >
                        {showOld ? (
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
                        placeholder="请输入新密码"
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
                {submitting ? '提交中...' : '确认修改'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
