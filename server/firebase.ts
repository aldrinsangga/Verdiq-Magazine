import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  limit, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
  QueryConstraint
} from 'firebase/firestore';
import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase Admin SDK (for Auth and Storage only)
let adminApp: any;
const projectId = firebaseConfig.projectId;

try {
  if (getAdminApps().length === 0) {
    adminApp = initializeAdminApp({
      projectId: projectId,
      storageBucket: firebaseConfig.storageBucket
    });
  } else {
    adminApp = getAdminApp();
  }
} catch (e: any) {
  console.error(`[Admin SDK] Initialization error:`, e.message);
  adminApp = getAdminApp();
}

export const adminAuth = getAdminAuth(adminApp);
export const adminStorage = getAdminStorage(adminApp);

// Initialize Firebase Client SDK
// We use this for Firestore on the server to bypass Service Account permission issues
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);
const clientDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Compatibility Layer to mimic Admin SDK syntax using Client SDK
class DocWrapper {
  constructor(private collectionPath: string, private docId: string) {}

  async get() {
    const docRef = doc(clientDb, this.collectionPath, this.docId);
    const snapshot = await getDoc(docRef);
    return {
      exists: snapshot.exists(),
      id: snapshot.id,
      data: () => snapshot.data()
    };
  }

  async set(data: any, options?: any) {
    const docRef = doc(clientDb, this.collectionPath, this.docId);
    return await setDoc(docRef, data, options);
  }

  async update(data: any) {
    const docRef = doc(clientDb, this.collectionPath, this.docId);
    return await updateDoc(docRef, data);
  }

  async delete() {
    const docRef = doc(clientDb, this.collectionPath, this.docId);
    return await deleteDoc(docRef);
  }
}

class CollectionWrapper {
  private constraints: QueryConstraint[] = [];

  constructor(private path: string) {}

  where(field: string, op: any, value: any) {
    this.constraints.push(where(field, op, value));
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.constraints.push(orderBy(field, direction));
    return this;
  }

  limit(n: number) {
    this.constraints.push(limit(n));
    return this;
  }

  doc(id: string) {
    return new DocWrapper(this.path, id);
  }

  async get() {
    const q = query(collection(clientDb, this.path), ...this.constraints);
    const snapshot = await getDocs(q);
    return {
      empty: snapshot.empty,
      size: snapshot.size,
      docs: snapshot.docs.map(d => ({
        id: d.id,
        data: () => d.data()
      }))
    };
  }

  async add(data: any) {
    const newDocRef = doc(collection(clientDb, this.path));
    await setDoc(newDocRef, data);
    return { id: newDocRef.id };
  }
}

export const db = {
  collection: (path: string) => new CollectionWrapper(path)
};

export const FieldValue = {
  serverTimestamp,
  increment,
  delete: () => undefined
};
export { Timestamp };

// Storage helper
export const uploadToStorage = async (base64Data: string, path: string, mimeType: string): Promise<string> => {
  const bucketName = firebaseConfig.storageBucket;
  try {
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
  console.log(`[ensureDbReady] Testing Firestore Client SDK connectivity...`);
  try {
    await db.collection('health_check').limit(1).get();
    console.log("[ensureDbReady] Firestore Client SDK connection verified.");
  } catch (e: any) {
    console.error(`[ensureDbReady] Firestore Client SDK connection failed: ${e.message}`);
  }
};

export default app;
