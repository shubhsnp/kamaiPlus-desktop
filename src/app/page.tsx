'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getStoredUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';

const DashboardHome = dynamic(() => import('@/components/dashboard/DashboardHome'), { ssr: false });

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
      router.replace('/auth');
    }
  }, [router]);

  if (isLoggedIn === null || isLoggedIn === false) {
    return null;
  }

  return <DashboardHome />;
}
