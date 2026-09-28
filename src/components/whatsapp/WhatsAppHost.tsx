'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { WHATSAPP_EVENT, WhatsAppRequest } from '@/lib/whatsapp/openWhatsApp';

const WhatsAppComposer = dynamic(() => import('./WhatsAppComposer').then((m) => m.WhatsAppComposer), { ssr: false });

/** In the app shell (v4.79.0): shows the WhatsApp window whenever something asks for it. */
export function WhatsAppHost() {
  const [request, setRequest] = useState<WhatsAppRequest | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => setRequest((e as CustomEvent<WhatsAppRequest>).detail);
    window.addEventListener(WHATSAPP_EVENT, onOpen);
    return () => window.removeEventListener(WHATSAPP_EVENT, onOpen);
  }, []);
  return request ? <WhatsAppComposer request={request} onClose={() => setRequest(null)} /> : null;
}
