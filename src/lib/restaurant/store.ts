'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RestLine, RestOrder, TokenCounter } from '@/lib/restaurant/model';
import { RESTAURANT_CHANGED_EVENT, RestaurantSettings, loadRestaurantSettings } from '@/lib/restaurant/settings';

/*
 * The running orders of Restaurant mode (v4.106.0), kept on this computer in localStorage like the
 * counter's held bills (`kamai_pos_tabs`): they survive closing the app and a restart, and become
 * an ordinary Sale when the bill is paid. Nothing here goes to the shop's database or the cloud.
 */

export const RESTAURANT_ORDERS_KEY = 'kamai_restaurant_orders';

export interface RestState {
  orders: RestOrder[];
  token: TokenCounter | null;
}

const EMPTY: RestState = { orders: [], token: null };

const str = (v: unknown, max = 80): string => String(v ?? '').slice(0, max);
const int = (v: unknown, min = 0): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, n) : min;
};

function cleanLine(raw: any): RestLine | null {
  if (!raw || typeof raw !== 'object' || !raw.key || !raw.productId) return null;
  return {
    key: str(raw.key, 300), productId: str(raw.productId, 80), name: str(raw.name, 120), unit: raw.unit || 'piece',
    qty: int(raw.qty), basePaise: int(raw.basePaise), kotQty: int(raw.kotQty), note: str(raw.note, 120),
    addOns: (Array.isArray(raw.addOns) ? raw.addOns : []).slice(0, 12).map((a: any) => ({ name: str(a?.name, 30), pricePaise: int(a?.pricePaise) })).filter((a: any) => a.name),
  };
}

/** Whatever is stored → valid state (a damaged entry is dropped, never a crash on the Tables screen). */
export function parseRestState(raw: unknown): RestState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const orders: RestOrder[] = [];
  for (const o of Array.isArray(r.orders) ? r.orders : []) {
    if (!o || typeof o !== 'object' || !o.id || !o.label || (o.kind !== 'table' && o.kind !== 'takeaway' && o.kind !== 'delivery')) continue;
    const g = o.guest && typeof o.guest === 'object' ? o.guest : null;
    orders.push({
      id: str(o.id), kind: o.kind, label: str(o.label, 30), openedAt: str(o.openedAt, 40), updatedAt: str(o.updatedAt, 40), kotRounds: int(o.kotRounds),
      lines: (Array.isArray(o.lines) ? o.lines : []).map(cleanLine).filter((l: RestLine | null): l is RestLine => Boolean(l)),
      ...(g ? { guest: { name: str(g.name, 40), phone: str(g.phone, 15), address: str(g.address, 160) } } : {}),
      ...(o.kotRequestedAt ? { kotRequestedAt: str(o.kotRequestedAt, 40) } : {}),
      ...(o.takenBy ? { takenBy: str(o.takenBy, 40) } : {}),
    });
  }
  const t = r.token;
  const token = t && typeof t === 'object' && typeof t.day === 'string' ? { day: str(t.day, 12), last: int(t.last) } : null;
  return { orders, token };
}

export function loadRestState(): RestState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    return parseRestState(JSON.parse(localStorage.getItem(RESTAURANT_ORDERS_KEY) || 'null'));
  } catch {
    return EMPTY;
  }
}

export function saveRestState(state: RestState): void {
  try {
    localStorage.setItem(RESTAURANT_ORDERS_KEY, JSON.stringify(state));
  } catch {}
  window.dispatchEvent(new Event(RESTAURANT_CHANGED_EVENT));
}

/** The orders and the shop's set-up; `update` always starts from what is saved right now. */
export function useRestaurant(): {
  state: RestState;
  settings: RestaurantSettings;
  update: (change: (s: RestState) => RestState) => void;
} {
  const [state, setState] = useState<RestState>(EMPTY);
  const [settings, setSettings] = useState<RestaurantSettings>(() => loadRestaurantSettings());

  useEffect(() => {
    const refresh = () => {
      setState(loadRestState());
      setSettings(loadRestaurantSettings());
    };
    refresh();
    window.addEventListener(RESTAURANT_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(RESTAURANT_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const update = useCallback((change: (s: RestState) => RestState) => {
    saveRestState(change(loadRestState()));
  }, []);

  return { state, settings, update };
}
