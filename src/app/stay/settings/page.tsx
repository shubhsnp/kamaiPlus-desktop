'use client';

import { StayModule } from '@/components/stay/StayModule';
import { StaySettingsPage } from '@/components/stay/settings/StaySettingsPage';

export default function StaySettingsRoute() {
  return (
    <StayModule currentTab="settings">
      <StaySettingsPage />
    </StayModule>
  );
}
