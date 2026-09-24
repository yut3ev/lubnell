'use client';

// U84 — branded in-app confirmation dialogs replacing native window.confirm.
// Any component can call confirmDialog({ title, message, danger }) from an
// event handler; <ConfirmHost /> (mounted once in the root layout) renders
// the LUBNÉL-styled AlertDialog and resolves the promise. Without a host the
// promise resolves false (fail-safe: nothing is deleted by accident).

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** destructive red confirm button (deletes) */
  danger?: boolean;
};

let hostFn: ((o: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  if (!hostFn) return Promise.resolve(false);
  return hostFn(o);
}

export function ConfirmHost() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolver = React.useRef<((v: boolean) => void) | null>(null);

  React.useEffect(() => {
    hostFn = (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      });
    return () => {
      hostFn = null;
    };
  }, []);

  const settle = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <AlertDialog open={!!opts} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent dir="rtl" className="max-w-sm rounded-[2rem] border-[#7a2e3b]/25 bg-[#faf6f1] text-right shadow-2xl">
        <AlertDialogHeader className="space-y-2 text-right">
          <AlertDialogTitle className="text-lg font-black text-[#43242b]">{opts?.title}</AlertDialogTitle>
          {opts?.message ? (
            <AlertDialogDescription className="text-sm leading-6 text-[#8a6f75]">{opts.message}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2 sm:justify-start">
          <AlertDialogCancel
            onClick={() => settle(false)}
            className="h-11 rounded-full border-border/60 bg-transparent px-6 text-sm font-bold text-[#43242b] hover:bg-black/5"
          >
            {opts?.cancelText || 'إلغاء'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={`h-11 rounded-full px-6 text-sm font-bold shadow-md ${
              opts?.danger
                ? 'bg-[#7a2e3b] text-[#fdf4f5] hover:bg-[#6e2e33]'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {opts?.confirmText || 'تأكيد'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
