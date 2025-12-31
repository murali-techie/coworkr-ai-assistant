'use client';

import { ToastProvider } from '@/components/ui/Toast';

export default function Providers({ children }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
