import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import admin from 'firebase-admin';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, addDoc } from 'firebase/firestore';
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

// Ensure GOOGLE_CLOUD_PROJECT is set for Admin SDK
if (firebaseConfig.projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
}

// Initialize Firebase Admin SDK (for Auth and Storage)
let adminApp: any;
try {
  if (getAdminApps().length === 0) {
    adminApp = initializeAdminApp();
    console.log("Firebase Admin SDK initialized with defaults.");
  } else {
    adminApp = getAdminApp();
  }
} catch (e: any) {
  console.error("Failed to initialize Firebase Admin SDK with defaults:", e);
  try {
    adminApp = initializeAdminApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId
    });
    console.log(`Firebase Admin SDK initialized for project: ${firebaseConfig.projectId}`);
  } catch (e2: any) {
    console.error("Failed to initialize Firebase Admin SDK with explicit config:", e2);
  }
}

export const adminAuth = adminApp ? getAdminAuth(adminApp) : null;
export const adminStorage = adminApp ? getAdminStorage(adminApp) : null;

// Initialize Firebase Client SDK
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);

// Sign in as server user to enable Client SDK with proper "isServer" permissions
const signInServer = async () => {
  try {
    await signInWithEmailAndPassword(auth, "server-internal-v2@verdiq.ai", "server-internal-password-2026");
    console.log("Server session established for Firestore access.");
  } catch (e: any) {
    console.error("Failed to establish server session:", e.message);
  }
};
signInServer();

const clientDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Export a unified db object using the Client SDK
export const db = {
  collection: (path: string) => {
    const colRef = collection(clientDb, path);
    
    const builder = (q: any) => ({
      where: (field: string, op: any, value: any) => builder(query(q, where(field, op, value))),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => builder(query(q, orderBy(field, direction))),
      limit: (n: number) => builder(query(q, limit(n))),
      get: async () => {
        const snapshot = await getDocs(q);
        return {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
        };
      }
    });

    return {
      doc: (id: string) => {
        const docRef = doc(clientDb, path, id);
        return {
          get: async () => {
            const d = await getDoc(docRef);
            return { exists: d.exists(), id: d.id, data: () => d.data() };
          },
          set: (data: any) => setDoc(docRef, data),
          update: (data: any) => updateDoc(docRef, data),
          delete: () => deleteDoc(docRef)
        };
      },
      add: async (data: any) => {
        const ref = await addDoc(colRef, data);
        return { id: ref.id };
      },
      get: async () => {
        const snapshot = await getDocs(colRef);
        return {
          empty: snapshot.empty,
          size: snapshot.size,
          docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
        };
      },
      where: (field: string, op: any, value: any) => builder(query(colRef, where(field, op, value))),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => builder(query(colRef, orderBy(field, direction))),
      limit: (n: number) => builder(query(colRef, limit(n)))
    };
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
  console.log(`[ensureDbReady] Verifying Firestore connectivity via Client SDK...`);
  try {
    await db.collection('health_check').limit(1).get();
    console.log("[ensureDbReady] Firestore connection verified.");
  } catch (e: any) {
    console.error(`[ensureDbReady] Firestore connection failed: ${e.message}`);
  }
};

export default app;
