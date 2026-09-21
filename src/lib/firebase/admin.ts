import * as admin from 'firebase-admin';

function getAdminApp() {
  if (!admin.apps.length) {
    // For local development and mock endpoints, we initialize admin without full credentials
    // if they are not provided. In production, provide the service account.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project'
    });
  }
  return admin.app();
}

export async function getAdminFirestore() {
  const app = getAdminApp();
  return app.firestore();
}

export async function getAdminAuth() {
  const app = getAdminApp();
  return app.auth();
}
