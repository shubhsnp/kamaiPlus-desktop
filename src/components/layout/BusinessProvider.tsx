'use client';

import React, { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Business } from '@/types';

/**
 * Single source of truth for the active business record.
 *
 * Previously, Navbar, Sidebar, DesktopStatusBar, BottomNav, GlobalDrawers,
 * and MobileMenuCardsModal each ran their own `useLiveQuery` against
 * `db.businesses`.  That meant 6 redundant IndexedDB reads on every
 * navigation and 6 independent Dexie subscriptions firing independently.
 *
 * Now the query runs once here and all consumers read from React context.
 */

const BusinessContext = createContext<Business | undefined>(undefined);

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const business = useLiveQuery(() => db.businesses.toCollection().first());

  return (
    <BusinessContext.Provider value={business}>
      {children}
    </BusinessContext.Provider>
  );
}

/**
 * Hook to read the current business from context.
 * Must be called inside a `<BusinessProvider>`.
 */
export function useBusiness(): Business | undefined {
  return useContext(BusinessContext);
}
