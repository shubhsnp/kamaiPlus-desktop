'use client';

import { StayModule } from '@/components/stay/StayModule';
import { CheckOutPage } from '@/components/stay/checkout/CheckOutPage';

export default function StayCheckOutRoute() {
  return (
    <StayModule currentTab="checkout">
      <CheckOutPage />
    </StayModule>
  );
}
