'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Check,
  X,
  Info,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ className, style, icons, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className={cn('toaster group', className)}
      position="top-center"
      icons={{
        success: (
          <Check
            className="size-4 text-success"
          />
        ),
        info: (
          <Info
            className="size-4 text-info"
          />
        ),
        warning: (
          <AlertTriangle
            className="size-4 text-warning"
          />
        ),
        error: (
          <X
            className="size-4 text-destructive"
          />
        ),
        close: <X className="size-4 text-accent-foreground" />,
        loading: <Loader2 className="size-4 animate-spin text-primary" />,
        ...icons,
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
