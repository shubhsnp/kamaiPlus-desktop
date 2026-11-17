'use client';

import { StayModule } from '@/components/stay/StayModule';
import { HousekeepingBoard } from '@/components/stay/housekeeping/HousekeepingBoard';

export default function StayHousekeepingRoute() {
  return (
    <StayModule currentTab="housekeeping">
      <HousekeepingBoard />
    </StayModule>
  );
}
