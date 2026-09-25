import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { AppShell } from '@/components/layout/AppShell';
import { LicenceGate } from '@/components/licence/LicenceGate';
import { ErrorReporter } from '@/components/layout/ErrorReporter';

import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner';

export const metadata: Metadata = {
  title: 'KamaiPlus Desktop | Business Management & Growth Platform',
  description: 'Sell, Manage, and Grow your local Indian business with instant POS billing, offline Khata, inventory, and WhatsApp marketing.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />

      <body>
        <ErrorReporter />
        <I18nProvider>
          <LicenceGate>
            <AppShell>
              {children}
            </AppShell>
            <PWAInstallBanner />
          </LicenceGate>
        </I18nProvider>
      </body>
    </html>
  );
}