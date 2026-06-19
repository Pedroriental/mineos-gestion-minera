'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileDashboard } from '@/components/mobile/MobileDashboard';
import SatelliteCommandClient from '@/components/dashboard/SatelliteCommandClient';
import type { LocationData, GlobalData } from '@/components/dashboard/types';

export default function DashboardMobileWrapper({
  locations,
  globalData,
  role,
}: {
  locations: LocationData[];
  globalData: GlobalData;
  role: string;
}) {
  const mobile = useIsMobile();

  if (mobile) return <MobileDashboard locations={locations} globalData={globalData} role={role} />;
  return <SatelliteCommandClient locations={locations} globalData={globalData} role={role} />;
}
