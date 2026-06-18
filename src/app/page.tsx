'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LoginPage = dynamic(() => import('@/components/LoginPage'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f6]">
      <div className="h-8 w-8 rounded-full border-2 border-amber-400/25 border-t-amber-400 animate-spin" />
    </div>
  ),
});

const MobileLoginPage = dynamic(
  () => import('@/components/mobile/MobileLoginPage').then((m) => ({ default: m.MobileLoginPage })),
  {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="h-8 w-8 rounded-full border-2 border-amber-400/25 border-t-amber-400 animate-spin" />
      </div>
    ),
  },
);

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(window.innerWidth < 768);
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return null;
  }

  if (mobile) return <MobileLoginPage />;
  return <LoginPage />;
}
