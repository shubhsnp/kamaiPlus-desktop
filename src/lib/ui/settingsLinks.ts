/*
 * Links into a Settings tab (v4.78.0) — from the status bar, Help, the label setup…
 * /settings?tab=invoice opens that tab; when Settings is already open, the tab is
 * switched with an event instead (a same-page link does not remount the page), and
 * the page's own switch still asks about unsaved changes first.
 */

export type SettingsTabId = 'profile' | 'invoicing' | 'staff' | 'data' | 'help';

export const SETTINGS_TAB_EVENT = 'kamai_settings_tab';

const QUERY_TABS: Record<string, SettingsTabId> = {
  profile: 'profile',
  store: 'profile',
  // v4.118.0: the Features tab is gone (the app follows the shop's category) — old links open Store.
  features: 'profile',
  // UPI QR & bank details are part of Store Profile since v4.78.0.
  upi: 'profile',
  invoice: 'invoicing',
  invoicing: 'invoicing',
  staff: 'staff',
  data: 'data',
  help: 'help',
};

/** ?tab= value → the tab (null = not a tab). */
export function settingsTabFromQuery(value: string | null | undefined): SettingsTabId | null {
  return QUERY_TABS[String(value || '').toLowerCase()] || null;
}

/** Opens a Settings tab: switches in place on /settings, else goes there. */
export function openSettingsTab(tab: SettingsTabId, pathname: string, push: (href: string) => void) {
  if (pathname === '/settings') {
    window.dispatchEvent(new CustomEvent<SettingsTabId>(SETTINGS_TAB_EVENT, { detail: tab }));
    return;
  }
  push(`/settings?tab=${tab === 'invoicing' ? 'invoice' : tab}`);
}
