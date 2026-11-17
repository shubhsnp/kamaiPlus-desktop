'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isStayEnabled } from '@/lib/stay/stayActivation';
import { StayDashboard } from '@/components/stay/dashboard/StayDashboard';

export default function StayPageRoute() {
  const router = useRouter();

  useEffect(() => {
    if (!isStayEnabled()) {
      router.replace('/');
    }
  }, [router]);

  if (!isStayEnabled()) {
    return null;
  }

  return <StayDashboard />;
}
