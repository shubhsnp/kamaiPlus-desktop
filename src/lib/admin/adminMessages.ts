import type { AdminMessage } from '@/lib/desktop/desktopBridge';

/** Which Admin messages this computer shows, and which the shop has closed (v4.98.0). */

const DISMISSED_KEY = 'kp_admin_messages_dismissed';

export function readDismissedMessages(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDismissedMessage(id: string): void {
  try {
    const next = [...readDismissedMessages().filter((x) => x !== id), id].slice(-50);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    // the banner simply shows again next time
  }
}

/**
 * Which messages show: not past their `until`, not closed. An "urgent" one closes only
 * until the app is opened again (sessionClosed); info / warning stay closed for good.
 */
export function visibleAdminMessages(messages: AdminMessage[], dismissed: string[], sessionClosed: string[], nowMs = Date.now()): AdminMessage[] {
  return messages.filter((m) => {
    if (m.until && Date.parse(m.until) <= nowMs) return false;
    if (sessionClosed.includes(m.id)) return false;
    return m.level === 'urgent' || !dismissed.includes(m.id);
  });
}
