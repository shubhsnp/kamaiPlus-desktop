'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getStoredUser } from '@/lib/auth';

const DashboardHome = dynamic(() => import('@/components/dashboard/DashboardHome'), { ssr: false });
const MarketingHome = dynamic(() => import('@/components/marketing/MarketingHome'), { ssr: false });

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredUser()));
  }, []);

  if (isLoggedIn === null) {
    return null;
  }

  return isLoggedIn ? <DashboardHome /> : <MarketingHome />;
}
