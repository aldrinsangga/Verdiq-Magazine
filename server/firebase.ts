import { initializeApp as initializeAdminApp, getApps as getAdminApps, getApp as getAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

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
  adminApp = getAdminApp();
}

export const adminAuth = getAdminAuth(adminApp);
export const adminStorage = getAdminStorage(adminApp);

// Initialize Firebase Client SDK
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Firestore REST API Wrapper
 * This is used because the Admin SDK has issues in this environment.
 */
class FirestoreREST {
  private baseUrl: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
  }

  private async getAuthToken() {
    const now = Date.now();
    if (this.token && now < this.tokenExpiry - 60000) {
      return this.token;
    }

    try {
      const SERVER_EMAIL = "server-internal@verdiq.ai";
      const SERVER_PASSWORD = "a-very-secure-internal-password-123";
      
      console.log(`[FirestoreREST] Authenticating as ${SERVER_EMAIL}...`);
      const userCredential = await signInWithEmailAndPassword(auth, SERVER_EMAIL, SERVER_PASSWORD);
      this.token = await userCredential.user.getIdToken();
      this.tokenExpiry = now + 3600000; // 1 hour
      console.log(`[FirestoreREST] Authentication successful. UID: ${userCredential.user.uid}`);
      return this.token;
    } catch (e: any) {
      console.error(`[FirestoreREST] Authentication failed: ${e.message}`);
      throw e;
    }
  }

  private async request(path: string, method: string = 'GET', body?: any) {
    const token = await this.getAuthToken();
    const apiKey = firebaseConfig.apiKey;
    const url = `${this.baseUrl}/${path}${path.includes('?') ? '&' : '?'}key=${apiKey}`;
    
    const headers: any = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: any = {
      method,
      headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FirestoreREST] Request failed: ${method} ${url}`, errorText);
      throw new Error(`Firestore REST Error: ${response.status} ${errorText}`);
    }
    return await response.json();
  }

  async getDocument(collection: string, id: string) {
    const data = await this.request(`${collection}/${id}`);
    return this.mapFromFirestore(data);
  }

  async listDocuments(collection: string) {
    return await this.runQuery(collection, {});
  }

  async createDocument(collection: string, id: string, data: any) {
    const firestoreData = this.mapToFirestore(data);
    const result = await this.request(`${collection}?documentId=${id}`, 'POST', firestoreData);
    return this.mapFromFirestore(result);
  }

  async updateDocument(collection: string, id: string, data: any) {
    const firestoreData = this.mapToFirestore(data);
    const updateMask = Object.keys(data)
      .filter(key => key !== '')
      .map(key => `updateMask.fieldPaths=${key}`)
      .join('&');
    const result = await this.request(`${collection}/${id}?${updateMask}`, 'PATCH', firestoreData);
    return this.mapFromFirestore(result);
  }

  async deleteDocument(collection: string, id: string) {
    await this.request(`${collection}/${id}`, 'DELETE');
  }

  async runQuery(collectionId: string, constraints: any) {
    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId;
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
    
    const token = await this.getAuthToken();
    const structuredQuery: any = {
      from: [{ collectionId }]
    };

    if (constraints.where) {
      const filters = constraints.where.map((w: any) => ({
        fieldFilter: {
          field: { fieldPath: w.field },
          op: this.mapOperator(w.op),
          value: this.mapValueToFirestore(w.value)
        }
      }));
      if (filters.length === 1) {
        structuredQuery.where = filters[0];
      } else if (filters.length > 1) {
        structuredQuery.where = { compositeFilter: { op: 'AND', filters } };
      }
    }

    if (constraints.orderBy) {
      structuredQuery.orderBy = constraints.orderBy.map((o: any) => ({
        field: { fieldPath: o.field },
        direction: o.direction === 'desc' ? 'DESCENDING' : 'ASCENDING'
      }));
    }

    if (constraints.limit) {
      structuredQuery.limit = constraints.limit;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ structuredQuery })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FirestoreREST] Query failed:`, errorText);
      throw new Error(`Firestore REST Query Error: ${response.status} ${errorText}`);
    }

    const results = await response.json();
    return results
      .filter((r: any) => r.document)
      .map((r: any) => this.mapFromFirestore(r.document));
  }

  private mapOperator(op: string) {
    const map: any = {
      '==': 'EQUAL',
      '>': 'GREATER_THAN',
      '<': 'LESS_THAN',
      '>=': 'GREATER_THAN_OR_EQUAL',
      '<=': 'LESS_THAN_OR_EQUAL',
      'array-contains': 'ARRAY_CONTAINS',
      'in': 'IN',
      'array-contains-any': 'ARRAY_CONTAINS_ANY',
      '!=': 'NOT_EQUAL'
    };
    return map[op] || 'EQUAL';
  }

  private mapToFirestore(data: any) {
    const fields: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== '') {
        fields[key] = this.mapValueToFirestore(value);
      }
    }
    return { fields };
  }

  private mapValueToFirestore(value: any): any {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') return { doubleValue: value };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (Array.isArray(value)) {
      return { 
        arrayValue: { 
          values: value.map(v => {
            if (Array.isArray(v)) {
              return { stringValue: JSON.stringify(v) };
            }
            return this.mapValueToFirestore(v);
          }) 
        } 
      };
    }
    if (typeof value === 'object') {
      const fields: any = {};
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined && k !== '') {
          fields[k] = this.mapValueToFirestore(v);
        }
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
  }

  private mapFromFirestore(doc: any) {
    if (!doc || !doc.fields) return doc;
    const data: any = { id: doc.name.split('/').pop() };
    for (const [key, value] of Object.entries(doc.fields)) {
      data[key] = this.mapValueFromFirestore(value);
    }
    return data;
  }

  private mapValueFromFirestore(value: any): any {
    if ('stringValue' in value) return value.stringValue;
    if ('doubleValue' in value) return parseFloat(value.doubleValue);
    if ('integerValue' in value) return parseInt(value.integerValue);
    if ('booleanValue' in value) return value.booleanValue;
    if ('timestampValue' in value) return new Date(value.timestampValue);
    if ('nullValue' in value) return null;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map((v: any) => this.mapValueFromFirestore(v));
    if ('mapValue' in value) {
      const data: any = {};
      for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
        data[k] = this.mapValueFromFirestore(v);
      }
      return data;
    }
    return value;
  }
}

const rest = new FirestoreREST();

class QueryBuilder {
  private constraints: any = { where: [], orderBy: [], limit: null };

  constructor(private collectionId: string) {}

  where(field: string, op: string, value: any) {
    this.constraints.where.push({ field, op, value });
    return this;
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.constraints.orderBy.push({ field, direction });
    return this;
  }

  limit(n: number) {
    this.constraints.limit = n;
    return this;
  }

  async get() {
    const results = await rest.runQuery(this.collectionId, this.constraints);
    return {
      empty: results.length === 0,
      size: results.length,
      docs: results.map((r: any) => ({
        id: r.id,
        data: () => r
      }))
    };
  }
}

export const db = {
  collection: (path: string) => {
    return {
      doc: (id: string) => ({
        get: () => rest.getDocument(path, id).then(data => ({
          exists: !!data,
          id: data.id,
          data: () => data
        })),
        set: (data: any) => rest.createDocument(path, id, data),
        update: (data: any) => rest.updateDocument(path, id, data),
        delete: () => rest.deleteDocument(path, id)
      }),
      add: (data: any) => {
        const id = Math.random().toString(36).substring(7);
        return rest.createDocument(path, id, data).then(res => ({ id: res.id }));
      },
      get: () => rest.listDocuments(path).then(docs => ({
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.map((d: any) => ({
          id: d.id,
          data: () => d
        }))
      })),
      where: (field: string, op: string, value: any) => new QueryBuilder(path).where(field, op, value),
      orderBy: (field: string, direction: 'asc' | 'desc' = 'asc') => new QueryBuilder(path).orderBy(field, direction),
      limit: (n: number) => new QueryBuilder(path).limit(n)
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
