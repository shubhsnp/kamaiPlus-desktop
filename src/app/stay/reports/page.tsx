'use client';

import { StayModule } from '@/components/stay/StayModule';
import { StayReportsPage } from '@/components/stay/reports/StayReportsPage';

export default function StayReportsRoute() {
  return (
    <StayModule currentTab="reports">
      <StayReportsPage />
    </StayModule>
  );
}
