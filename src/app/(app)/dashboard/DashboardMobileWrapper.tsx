'use client';

import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileDashboard } from '@/components/mobile/MobileDashboard';
import SatelliteCommandClient from '@/components/dashboard/SatelliteCommandClient';
import MiningSupervisorDashboard from '@/components/dashboard/MiningSupervisorDashboard';
import MillSupervisorDashboard from '@/components/dashboard/MillSupervisorDashboard';
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

  if (role === 'mining_supervisor') {
    if (mobile) return <MobileDashboard locations={locations} globalData={globalData} role={role} />;
    return <MiningSupervisorDashboard data={globalData} />;
  }

  if (role === 'mill_supervisor') {
    if (mobile) return <MobileDashboard locations={locations} globalData={globalData} role={role} />;
    return <MillSupervisorDashboard data={globalData} locations={locations} />;
  }

  if (mobile) return <MobileDashboard locations={locations} globalData={globalData} role={role} />;
  return <SatelliteCommandClient locations={locations} globalData={globalData} role={role} />;
}
