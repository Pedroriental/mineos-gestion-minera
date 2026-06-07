'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { hasGlobalDateRange, type GlobalDateSearchParams } from '@/lib/global-date-range';

export function useGlobalDateRange(): GlobalDateSearchParams & { hasRange: boolean } {
  const searchParams = useSearchParams();
  const desde = searchParams.get('desde') ?? undefined;
  const hasta = searchParams.get('hasta') ?? undefined;
  const params = useMemo(() => ({ desde, hasta }), [desde, hasta]);
  return { ...params, hasRange: hasGlobalDateRange(params) };
}
