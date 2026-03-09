import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Helper to get Firestore with fallback
const getFirestoreWithFallback = () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  try {
    if (dbId && dbId !== "(default)" && dbId.trim() !== "") {
      return getFirestore(app, dbId);
    }
  } catch (e) {
    console.error("Failed to initialize named Firestore, falling back to default", e);
  }
  return getFirestore(app);
};

export const db = getFirestoreWithFallback();
export const auth = getAuth(app);

export default app;
