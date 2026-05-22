import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfigEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseConfigDirect = {
  apiKey: "AIzaSyDQxlxgipnT0OgVY_kxNL7opnMX9VTfEM8",
  authDomain: "mobus-6aaa9.firebaseapp.com",
  projectId: "mobus-6aaa9",
  storageBucket: "mobus-6aaa9.firebasestorage.app",
  messagingSenderId: "451827926532",
  appId: "1:451827926532:web:ecca071a400d5650299751"
};

// Select which configuration to use
const config = firebaseConfigEnv.apiKey && firebaseConfigEnv.apiKey !== "YOUR_API_KEY"
  ? firebaseConfigEnv 
  : firebaseConfigDirect;

// Initialize Firebase
const app = initializeApp(config);

// Initialize Firestore
const db = getFirestore(app);

export { db };
