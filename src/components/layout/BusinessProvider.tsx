'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Business } from '@/types';
import { syncVerticalGst } from '@/lib/business/verticalProfile';
import { FEATURE_SWITCHES_EVENT } from '@/lib/features/featureSwitches';

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
  const hasGstin = Boolean(business?.gstin && business.gstin.trim());

  // v4.118.0: a shop with a vertical profile gets GST screens / fields when it has a GSTIN — whichever
  // way the GSTIN arrived (Settings, a restored backup, the cloud). No profile = nothing happens.
  useEffect(() => {
    if (business === undefined) return;
    if (syncVerticalGst(hasGstin)) window.dispatchEvent(new Event(FEATURE_SWITCHES_EVENT));
  }, [business === undefined, hasGstin]); // eslint-disable-line react-hooks/exhaustive-deps

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
