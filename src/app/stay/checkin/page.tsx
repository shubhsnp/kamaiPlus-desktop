'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { isStayEnabled } from '@/lib/stay/stayActivation';
import { CheckInPage } from '@/components/stay/checkin/CheckInPage';

export default function CheckInPageRoute() {
  const router = useRouter();

  useEffect(() => {
    if (!isStayEnabled()) {
      router.replace('/');
    }
  }, [router]);

  if (!isStayEnabled()) {
    return null;
  }

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading check-in...</div>}>
      <CheckInPage />
    </Suspense>
  );
}
