import { VerticalProfile, isVerticalId, readVerticalProfile, saveVerticalProfile } from '@/lib/business/verticalProfile';

/*
 * One shop, one category on every device (v4.141.0, Rahul 2026-10-10: proventurein@ — the phone showed a
 * kirana, the PC a restaurant). The shop document's `business_type` is the shop's category and
 * `business_type_set_at` when it was chosen. A shop made on this PC before v4.137.0 went to the cloud as
 * 'grocery' whatever was chosen, with no time — this PC's own choice then goes up. A newer choice in the
 * cloud comes down here. The phone follows the cloud (its category is locked after signup).
 */

export type CategoryAction = 'none' | 'same' | 'push' | 'adopt';

const t = (iso?: unknown): number => {
  const n = Date.parse(String(iso || ''));
  return Number.isFinite(n) ? n : 0;
};

/** What to do with this PC's category against the cloud shop document. */
export function resolveShopCategory(local: VerticalProfile | null, cloud: { business_type?: unknown; business_type_set_at?: unknown }): CategoryAction {
  if (!local) return 'none'; // a shop without a profile (before v4.118.0) keeps its old behaviour
  const cloudType = isVerticalId(cloud.business_type) ? cloud.business_type : null;
  const cloudAt = t(cloud.business_type_set_at);
  if (cloudType === local.vertical) return cloudAt ? 'same' : 'push'; // stamp it once
  if (!cloudType || !cloudAt) return 'push'; // the cloud's value is an unstamped default
  return cloudAt > t(local.at) ? 'adopt' : 'push';
}

/**
 * Applies it for the cloud shop document just read. Returns the action taken. `write` merges fields into
 * the shop document (the caller owns Firestore).
 */
export async function syncShopCategory(
  cloud: Record<string, unknown>,
  write: (fields: Record<string, unknown>) => Promise<void>,
): Promise<CategoryAction> {
  const local = readVerticalProfile();
  const action = resolveShopCategory(local, cloud);
  if (!local) return action;
  if (action === 'push') {
    const at = local.at || new Date().toISOString();
    if (!local.at) saveVerticalProfile(local.vertical, local.gst, at);
    await write({ business_type: local.vertical, business_type_set_at: at });
  } else if (action === 'adopt' && isVerticalId(cloud.business_type)) {
    saveVerticalProfile(cloud.business_type, local.gst, String(cloud.business_type_set_at));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('feature_switches_changed'));
  }
  return action;
}
