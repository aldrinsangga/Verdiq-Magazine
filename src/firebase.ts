import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initialization failed", e);
  // Fallback or handle error
}

// Helper to get Firestore with fallback and long-polling enabled
const getFirestoreWithFallback = () => {
  if (!app) return null;
  const dbId = firebaseConfig.firestoreDatabaseId;
  const settings = {
    experimentalForceLongPolling: true,
  };

  try {
    if (dbId && dbId !== "(default)" && dbId.trim() !== "") {
      return initializeFirestore(app, settings, dbId);
    }
  } catch (e) {
    console.error("Failed to initialize named Firestore, falling back to default", e);
  }
  return initializeFirestore(app, settings);
};

export const db = getFirestoreWithFallback();
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
