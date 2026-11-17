'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { isStayEnabled } from '@/lib/stay/stayActivation';
import { RoomsPage } from '@/components/stay/rooms/RoomsPage';

export default function RoomsPageRoute() {
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
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading rooms...</div>}>
      <RoomsPage />
    </Suspense>
  );
}
