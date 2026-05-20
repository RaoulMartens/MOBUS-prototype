import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// You can configure Firebase in one of two ways:
//
// OPTION 1 (Recommended):
// Create a '.env' file in the root of the project (we already created a template for you)
// and fill in the values. Vite will automatically load them.
//
// OPTION 2:
// If you prefer not to use environment variables, you can paste your config object
// directly below in the 'firebaseConfigDirect' variable, and change the config selection.
// ==========================================

const firebaseConfigEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigDirect = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID_HERE.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_PROJECT_ID_HERE.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE"
};

// Select which configuration to use (defaults to Option 1: Env variables)
// Set this to firebaseConfigDirect if you paste your keys directly.
const config = firebaseConfigEnv.apiKey && firebaseConfigEnv.apiKey !== "YOUR_API_KEY"
  ? firebaseConfigEnv 
  : firebaseConfigDirect;

// Validate configuration
const isConfigured = config.apiKey && config.apiKey !== "YOUR_API_KEY_HERE" && config.apiKey !== "YOUR_API_KEY";

if (!isConfigured) {
  console.warn(
    "⚠️ Firebase has not been configured yet!\n" +
    "Please fill in your Firebase project keys in the '.env' file or directly in 'src/firebase.js'.\n" +
    "Database operations will fail until this is set up."
  );
}

// Initialize Firebase
const app = initializeApp(config);

// Initialize Firestore
const db = getFirestore(app);

export { db, isConfigured };
