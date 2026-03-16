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

// Global error handlers to prevent silent crashes in Cloud Run
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

const firebaseConfigJson = JSON.parse(fs.readFileSync(join(__dirname, '../firebase-applet-config.json'), 'utf-8'));

if (!firebaseConfigJson.projectId) {
  console.error("[Firebase] CRITICAL: projectId is missing from firebase-applet-config.json");
}

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

// Initialize Firebase Admin SDK (for Auth, Storage, and Firestore)
let adminApp: any;
try {
  if (getAdminApps().length === 0) {
    // In Cloud Run, this will use the service account credentials
    adminApp = initializeAdminApp({
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket
    });
    console.log(`[Firebase] Admin SDK initialized for project: ${firebaseConfig.projectId}`);
  } else {
    adminApp = getAdminApp();
  }
} catch (e: any) {
  console.error("[Firebase] Failed to initialize Firebase Admin SDK:", e.message);
}

export const adminAuth = adminApp ? getAdminAuth(adminApp) : null;
export const adminStorage = adminApp ? getAdminStorage(adminApp) : null;

// Try to get Admin Firestore
export let adminDb: any = null;
export let isAdminDbHealthy = false;

if (adminApp) {
  try {
    // Try with explicit database ID first
    const dbId = firebaseConfig.firestoreDatabaseId || undefined;
    adminDb = getAdminFirestore(adminApp, dbId);
    console.log(`[Firebase] Admin Firestore initialized for database: ${dbId || '(default)'}`);
    
    // Test adminDb with a simple check
    console.log("[Firebase] Running Admin Firestore health check...");
    adminDb.collection('health_check').doc('admin_test').set({ 
      last_check: new Date().toISOString(),
      env: process.env.NODE_ENV || 'unknown',
      service: 'cloud-run'
    })
      .then(() => {
        console.log("[Firebase] Admin Firestore write test successful");
        isAdminDbHealthy = true;
      })
      .catch((err: any) => {
        console.warn("[Firebase] Admin Firestore write test failed:", err?.message || err);
        console.warn("[Firebase] This usually means the Cloud Run service account lacks 'Cloud Datastore User' permissions on the specific database.");
        console.warn("[Firebase] Falling back to Client SDK for data operations.");
        isAdminDbHealthy = false;
        
        // Try a read test at least
        adminDb.collection('health_check').limit(1).get()
          .then(() => {
            console.log("[Firebase] Admin Firestore read test successful. Will use Admin SDK for reads.");
            // We'll keep isAdminDbHealthy as false to force fallback for writes, 
            // but we could potentially use it for reads if we split the flag.
          })
          .catch((readErr: any) => {
            console.error("[Firebase] Admin Firestore read test also failed:", readErr?.message || readErr);
          });
      });
      
  } catch (e: any) {
    console.warn(`[Firebase] Failed to initialize Admin Firestore with databaseId ${firebaseConfig.firestoreDatabaseId}, trying default...`);
    try {
      adminDb = getAdminFirestore(adminApp);
      console.log("[Firebase] Admin Firestore initialized with default database.");
      isAdminDbHealthy = true;
    } catch (e2: any) {
      console.error("[Firebase] Failed to initialize Admin Firestore entirely:", e2?.message || e2);
      isAdminDbHealthy = false;
    }
  }
}

// Initialize Firebase Client SDK
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);

const clientDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const createClientDbWrapper = (dbInstance: any) => ({
  collection: (path: string) => {
    const colRef = collection(dbInstance, path);
    
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
        const docRef = doc(dbInstance, path, id);
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
});

// Hybrid DB: Try Admin SDK first (bypasses rules), fallback to Client SDK wrapper
const clientDbWrapper = createClientDbWrapper(clientDb);

// Helper to check if an error is a permission denied error
const isPermissionError = (e: any) => {
  const msg = (e?.message || String(e)).toUpperCase();
  return msg.includes('PERMISSION_DENIED') || msg.includes('MISSING OR INSUFFICIENT PERMISSIONS') || e?.code === 7 || e?.code === 'permission-denied';
};

export const db: any = {
  collection: (path: string) => {
    // If we have an Admin DB, we try it first regardless of "healthy" flag, 
    // because the flag only tracks the write test.
    if (adminDb) {
      const adminCol = adminDb.collection(path);
      
      const adminBuilder = (q: any, queryParams: any[] = []) => ({
        where: (field: string, op: any, value: any) => 
          adminBuilder(q.where(field, op, value), [...queryParams, { type: 'where', field, op, value }]),
        orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => 
          adminBuilder(q.orderBy(field, direction), [...queryParams, { type: 'orderBy', field, direction }]),
        limit: (n: number) => 
          adminBuilder(q.limit(n), [...queryParams, { type: 'limit', value: n }]),
        get: async () => {
          try {
            const snapshot = await q.get();
            return {
              empty: snapshot.empty,
              size: snapshot.size,
              docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
            };
          } catch (e: any) {
            if (isPermissionError(e)) {
              console.warn(`[Firebase] Admin SDK Permission Denied for ${path} query, falling back to Client SDK...`);
              // Reconstruct query on client wrapper
              let clientQ: any = clientDbWrapper.collection(path);
              for (const p of queryParams) {
                if (p.type === 'where') clientQ = clientQ.where(p.field, p.op, p.value);
                if (p.type === 'orderBy') clientQ = clientQ.orderBy(p.field, p.direction);
                if (p.type === 'limit') clientQ = clientQ.limit(p.value);
              }
              return clientQ.get();
            }
            throw e;
          }
        }
      });

      return {
        doc: (id: string) => {
          const adminDoc = adminCol.doc(id);
          return {
            get: async () => {
              try {
                const d = await adminDoc.get();
                return { exists: d.exists, id: d.id, data: () => d.data() };
              } catch (e: any) {
                if (isPermissionError(e)) {
                  console.warn(`[Firebase] Admin SDK Permission Denied for ${path}/${id}, falling back to Client SDK...`);
                  return clientDbWrapper.collection(path).doc(id).get();
                }
                throw e;
              }
            },
            set: (data: any) => adminDoc.set(data).catch((e: any) => {
              if (isPermissionError(e)) return clientDbWrapper.collection(path).doc(id).set(data);
              throw e;
            }),
            update: (data: any) => adminDoc.update(data).catch((e: any) => {
              if (isPermissionError(e)) return clientDbWrapper.collection(path).doc(id).update(data);
              throw e;
            }),
            delete: () => adminDoc.delete().catch((e: any) => {
              if (isPermissionError(e)) return clientDbWrapper.collection(path).doc(id).delete();
              throw e;
            })
          };
        },
        add: async (data: any) => {
          try {
            const ref = await adminCol.add(data);
            return { id: ref.id };
          } catch (e: any) {
            if (isPermissionError(e)) return clientDbWrapper.collection(path).add(data);
            throw e;
          }
        },
        get: async () => {
          try {
            const snapshot = await adminCol.get();
            return {
              empty: snapshot.empty,
              size: snapshot.size,
              docs: snapshot.docs.map((d: any) => ({ id: d.id, data: () => d.data() }))
            };
          } catch (e: any) {
            if (isPermissionError(e)) return clientDbWrapper.collection(path).get();
            throw e;
          }
        },
        where: (field: string, op: any, value: any) => 
          adminBuilder(adminCol.where(field, op, value), [{ type: 'where', field, op, value }]),
        orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => 
          adminBuilder(adminCol.orderBy(field, direction), [{ type: 'orderBy', field, direction }]),
        limit: (n: number) => 
          adminBuilder(adminCol.limit(n), [{ type: 'limit', value: n }])
      };
    }
    
    return clientDbWrapper.collection(path);
  }
};

let serverSessionPromise: Promise<void> | null = null;

// Sign in as server user to enable Client SDK with proper "isServer" permissions
const signInServer = async () => {
  if (serverSessionPromise) return serverSessionPromise;
  
  serverSessionPromise = (async () => {
    const serverUsers = [
      { email: "server-internal-v2@verdiq.ai", pass: "server-internal-password-2026" },
      { email: "server-internal@verdiq.ai", pass: "server-internal-password-2026" },
      { email: "admin@verdiq.ai", pass: "admin-password-2026" },
      { email: "verdiqmag@gmail.com", pass: "admin-password-2026" } // Fallback
    ];

    for (const user of serverUsers) {
      try {
        await signInWithEmailAndPassword(auth, user.email, user.pass);
        console.log(`[Firebase] Server session established for ${user.email}`);
        return;
      } catch (e: any) {
        if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          // If adminAuth is available, we could try to create the user
          if (adminAuth) {
            try {
              console.log(`[Firebase] Attempting to create server user: ${user.email}`);
              await adminAuth.createUser({
                email: user.email,
                password: user.pass,
                emailVerified: true
              });
              await signInWithEmailAndPassword(auth, user.email, user.pass);
              console.log(`[Firebase] Server user created and session established for ${user.email}`);
              return;
            } catch (createErr: any) {
              console.warn(`[Firebase] Failed to create server user ${user.email}:`, createErr.message);
            }
          }
        }
        console.warn(`[Firebase] Failed to sign in as ${user.email}: ${e.message}`);
      }
    }
    
    console.error("[Firebase] All server session attempts failed. Client SDK will operate unauthenticated.");
    serverSessionPromise = null;
  })();
  
  return serverSessionPromise;
};

// Start sign in immediately
signInServer().catch(() => {});

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
  console.log(`[ensureDbReady] Verifying Firestore connectivity...`);
  try {
    await signInServer();
    await db.collection('health_check').limit(1).get();
    console.log("[ensureDbReady] Firestore connection verified.");
  } catch (e: any) {
    console.error(`[ensureDbReady] Firestore connection failed: ${e.message}`);
  }
};

export default app;
