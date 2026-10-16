/**
 * A stock at or above this is an "unlimited / uncounted" item, not a count (v4.175.0, was 99990).
 * The phone writes unlimited as 99999 and, until 2026-10-16, lowered the cloud copy by 1 per sale —
 * after 10 bills it arrived as a counted "99989" (Inventory Asset in crores). Same number as KamaiPlus
 * Android `CloudContract.unlimitedRepairAt`. A real shop never holds 99,900 of one item.
 */
export const UNLIMITED_REPAIR_AT = 99900;
