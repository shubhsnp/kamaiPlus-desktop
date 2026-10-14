'use client';

import type { StaffMember, StaffPermissions } from '@/lib/cloud/staff';

/**
 * Deprecated: Role permissions system removed as all staff members have
 * unrestricted billing and sales completion authority.
 */
export function StaffPermissionsDialog(_props: {
  open: boolean;
  member: StaffMember | null;
  onClose: () => void;
  onUpdated?: (memberId: string, permissions: StaffPermissions) => void;
}) {
  return null;
}
