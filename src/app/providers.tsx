'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
          icons={{
            success: '✓',
            error:   '✕',
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
