/**
 * v4.175.0: a bill made for a staff member carries `staff_day` = "<staff id>_<local yyyy-mm-dd>" in the
 * cloud, so the staff phone's "Today's Bills" reads its own bills with one equality query (no composite
 * index) — the rules let staff read only bills with their own staff_id. Same as KamaiPlus Android
 * `StaffBills.staffDay`. Before, a waiter's phone never saw any bill (they are made at the counter).
 */
export function staffDay(staffId: string, at: string | Date): string {
  const d = typeof at === 'string' ? new Date(at) : at;
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${staffId}_${day}`;
}
