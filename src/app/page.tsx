'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LoginPage = dynamic(() => import('@/components/LoginPage'), {
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-center gap-4">
      <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      <p className="text-xs font-medium text-zinc-400">Iniciando MineOS...</p>
    </div>
  ),
});

const MobileLoginPage = dynamic(
  () => import('@/components/mobile/MobileLoginPage').then((m) => ({ default: m.MobileLoginPage })),
  {
    loading: () => (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] text-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-xs font-medium text-zinc-400">Iniciando MineOS...</p>
      </div>
    ),
  },
);

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

  if (loading || user || isGuest) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#09090b] p-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/brand/mineos-logotipo-dark.svg" alt="MineOS" className="h-10 w-auto animate-pulse" />
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="text-xs font-medium text-zinc-400">Cargando Sistema de Gestión Minera...</p>
        </div>
      </div>
    );
  }

  if (mobile) return <MobileLoginPage />;
  return <LoginPage />;
}
