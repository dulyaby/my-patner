import { initializeApp, getApp } from 'firebase/app';
import { 
  getAuth,
  browserLocalPersistence,
  setPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  getDocFromServer,
  doc
} from 'firebase/firestore';

// Fallback config from the file provided by AI Studio
import firebaseConfigJson from '../firebase-applet-config.json';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

// Guard initialization to avoid blank white screen on error
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Re-try getting existing app if it was already initialized
  try {
    app = getApp();
  } catch (e) {
    // Create a dummy app/auth/db to prevent total crash, though functions will fail
    app = { name: "fallback" } as any;
  }
}

// Initialize Auth with persistence - fallback order handled by firebase
export const auth = getAuth(app);
const initPersistence = async () => {
  try {
    await setPersistence(auth, indexedDBLocalPersistence);
  } catch {
    await setPersistence(auth, browserLocalPersistence);
  }
};
initPersistence().catch(console.error);

// Use Firestore with persistent cache to allow offline support
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId;
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
}, databaseId);

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();
