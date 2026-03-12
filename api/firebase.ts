import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const firebaseConfigJson = JSON.parse(fs.readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf-8'));

const firebaseConfig = {
  ...firebaseConfigJson,
  apiKey: process.env.FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
};

// Initialize Firebase Admin SDK
let adminApp: any;
try {
  if (getAdminApps().length === 0) {
    adminApp = initializeAdminApp({
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket
    });
  } else {
    adminApp = getAdminApp();
  }
} catch (e: any) {
  console.warn("Failed to initialize Firebase Admin SDK:", e);
  try {
    adminApp = getAdminApp();
  } catch (e2) {
    console.warn("No Firebase Admin app available.");
  }
}

import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
export const adminAuth = adminApp ? getAdminAuth(adminApp) : null as any;
export const adminStorage = adminApp ? getAdminStorage(adminApp) : null as any;
export const adminDb = adminApp ? getAdminFirestore(adminApp) : null as any;

// Initialize Firebase Client SDK
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);

// ... (keep imports and initialization)

export const db = adminDb ? {
  collection: (path: string) => {
    const colRef = adminDb.collection(path);
    const builder = (query: any) => ({
      where: (field: string, op: any, value: any) => builder(query.where(field, op, value)),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => builder(query.orderBy(field, direction === 'desc' ? 'desc' : 'asc')),
      limit: (n: number) => builder(query.limit(n)),
      get: async () => {
        const snapshot = await query.get();
        return {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
        };
      }
    });

    return {
      doc: (id: string) => {
        const docRef = colRef.doc(id);
        return {
          get: async () => {
            const doc = await docRef.get();
            return { exists: doc.exists, id: doc.id, data: () => doc.data() };
          },
          set: (data: any) => docRef.set(data),
          update: (data: any) => docRef.update(data),
          delete: () => docRef.delete()
        };
      },
      add: async (data: any) => {
        const ref = await colRef.add(data);
        return { id: ref.id };
      },
      get: async () => {
        const snapshot = await colRef.get();
        return {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
        };
      },
      where: (field: string, op: any, value: any) => builder(colRef).where(field, op, value),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => builder(colRef).orderBy(field, direction),
      limit: (n: number) => builder(colRef).limit(n)
    };
  }
} : {
  collection: (path: string) => {
    throw new Error("Firestore Admin SDK not initialized. Ensure Firebase is configured correctly.");
  }
};

export const FieldValue = {
  serverTimestamp: () => new Date(),
  increment: (n: number) => n,
  delete: () => undefined
};

// Storage helper
export const uploadToStorage = async (base64Data: string, path: string, mimeType: string): Promise<string> => {
  const bucketName = firebaseConfig.storageBucket;
  try {
    if (!adminStorage) throw new Error("adminStorage is null");
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(path);
    const buffer = Buffer.from(base64Data, 'base64');
    await file.save(buffer, { metadata: { contentType: mimeType }, resumable: false });
    try { await file.makePublic(); } catch (e) {}
    return `https://storage.googleapis.com/${bucketName}/${path}`;
  } catch (adminError: any) {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Data, 'base64', { contentType: mimeType });
    return await getDownloadURL(storageRef);
  }
};

export const ensureDbReady = async () => {
  console.log(`[ensureDbReady] Verifying Firestore connectivity via REST API...`);
  try {
    await db.collection('health_check').limit(1).get();
    console.log("[ensureDbReady] Firestore connection verified.");
  } catch (e: any) {
    console.error(`[ensureDbReady] Firestore connection failed: ${e.message}`);
  }
};

export default app;
