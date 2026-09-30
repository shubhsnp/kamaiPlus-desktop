import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence, Auth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, setLogLevel, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getRemoteConfig, RemoteConfig } from 'firebase/remote-config';

// Suppress non-critical internal connection retry logs in browser console
if (typeof window !== 'undefined') {
  try {
    setLogLevel('error');
  } catch {}
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Local Firebase emulators (tests only — the cloud sync integration test sets these; a build never does).
const FIRESTORE_EMULATOR = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR || '';
const AUTH_EMULATOR = process.env.NEXT_PUBLIC_AUTH_EMULATOR || '';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let remoteConfig: RemoteConfig | null = null;

export function isValidFirebaseAppId(appId?: string): boolean {
  if (!appId) return false;
  // Firebase Web App ID format: 1:<project-number>:web:<alphanumeric-hash>
  // Must have a valid alphanumeric hash from Firebase console, not a placeholder word
  return /^1:\d+:web:[a-f0-9]{12,}$/i.test(appId);
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return null;
  }
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) {
    // The desktop app signs in with a Google ID token (lib/cloud/cloudAccount.ts), never a
    // popup / redirect — so no popup resolver; the session is kept in IndexedDB.
    try {
      auth = initializeAuth(firebaseApp, { persistence: indexedDBLocalPersistence });
    } catch {
      auth = getAuth(firebaseApp);
    }
    if (AUTH_EMULATOR) connectAuthEmulator(auth, AUTH_EMULATOR, { disableWarnings: true });
  }
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) {
    try {
      db = initializeFirestore(firebaseApp, {
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      db = getFirestore(firebaseApp);
    }
    if (FIRESTORE_EMULATOR) {
      const [host, port] = FIRESTORE_EMULATOR.split(':');
      connectFirestoreEmulator(db, host, Number(port));
    }
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!storage) {
    storage = getStorage(firebaseApp);
  }
  return storage;
}

export function getFirebaseRemoteConfig(): RemoteConfig | null {
  if (typeof window === 'undefined') return null;
  const firebaseApp = getFirebaseApp();
  // Remote Config and Firebase Installations require a genuine Firebase Web App ID
  if (!firebaseApp || !isValidFirebaseAppId(firebaseConfig.appId)) return null;
  
  if (!remoteConfig) {
    try {
      remoteConfig = getRemoteConfig(firebaseApp);
      remoteConfig.settings.minimumFetchIntervalMillis = 60000; // 1 minute cache
      remoteConfig.defaultConfig = {
        platform_ad_title: '⚡ Billed with KamaiPlus POS',
        platform_ad_subtitle: 'Free Retail Invoicing & Khata',
        platform_ad_desc: 'Get your free GST billing & WhatsApp invoicing app • kamaiplus.proventure.in',
        platform_ad_badge: 'Kamai+',
        platform_ad_url: 'https://kamaiplus.proventure.in',
        platform_ad_enabled: true,
      };
    } catch {
      return null;
    }
  }
  return remoteConfig;
}
