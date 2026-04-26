import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  browserLocalPersistence,
  setPersistence,
  indexedDBLocalPersistence,
  Persistence
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  getDocFromServer,
  doc
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

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
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
}, firebaseConfig.firestoreDatabaseId);

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
