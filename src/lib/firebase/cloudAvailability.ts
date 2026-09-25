/**
 * Whether this install can reach Firestore at all.
 *
 * The desktop app has no Firebase login — it unlocks with a local master password
 * (`components/auth/AuthForm.tsx`) — while the Firestore rules require
 * `request.auth` for every business document. Every cloud read and write was
 * therefore rejected, yet each bill still loaded the Firebase SDK and waited on the
 * network to be told "no".
 *
 * Until a real cloud login ships, every cloud path checks this flag first and does
 * nothing. Flip it only together with that login.
 */
export const CLOUD_SYNC_ENABLED = false;

export const CLOUD_SYNC_DISABLED_MESSAGE =
  'Cloud backup is not available in this version yet. Use "Download Backup" to save a backup file on this computer or a pen drive.';
