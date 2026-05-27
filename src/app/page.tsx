'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const LoginPage = dynamic(() => import('@/components/LoginPage'), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1E27]">
      <div
        className="h-8 w-8 rounded-full border-2 border-amber-400/25 border-t-amber-400 animate-spin"
        aria-hidden
      />
    </div>
  ),
});

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return null;
  }

  return <LoginPage />;
}
