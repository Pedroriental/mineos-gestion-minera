'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DisparosPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/mina/voladuras'); }, [router]);
  return null;
}

