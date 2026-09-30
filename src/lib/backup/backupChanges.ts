import type { DBCore, Middleware } from 'dexie';

/**
 * Has the shop's data changed since the last automatic backup was written?
 *
 * Every write to the database (a bill, a product, a khata entry, a restore...) goes
 * through Dexie's DBCore `mutate`, so one pass-through middleware sees them all —
 * no screen has to remember to report its writes. The hourly backup (autoBackup.ts)
 * skips its work while nothing changed, so an idle or overnight PC does not rewrite
 * the same file again and again.
 */

// Unknown at start: the app may have closed after bills that no backup holds yet.
let changed = true;

export function markDataChanged(): void {
  changed = true;
}

export function dataChangedSinceBackup(): boolean {
  return changed;
}

/** Called just before the backup reads the tables; a write after this marks it again. */
export function clearDataChanged(): void {
  changed = false;
}

/** Registered in lib/db/index.ts before the database opens. Changes nothing it passes on. */
export const backupChangeMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'backupChangeTracker',
  create: (down) => ({
    ...down,
    table: (tableName) => {
      const table = down.table(tableName);
      return {
        ...table,
        mutate: (req) =>
          table.mutate(req).then((res) => {
            markDataChanged();
            return res;
          }),
      };
    },
  }),
};
