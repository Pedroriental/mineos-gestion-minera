'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LoginPage from '@/components/LoginPage';
import { MobileLoginPage } from '@/components/mobile/MobileLoginPage';

export default function Home() {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(window.innerWidth < 768);
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!loading && (user || isGuest)) {
      router.replace('/dashboard');
    }
  }, [user, loading, isGuest, router]);

  // Si ya está autenticado, mostramos spinner mientras redirige a /dashboard
  if (!loading && (user || isGuest)) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#09090b] p-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/brand/mineos-logotipo-dark.svg" alt="MineOS" className="h-10 w-auto animate-pulse" />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-xs font-medium text-zinc-400">Ingresando al panel...</p>
        </div>
      </div>
    );
  }

  if (mobile) return <MobileLoginPage />;
  return <LoginPage />;
}
