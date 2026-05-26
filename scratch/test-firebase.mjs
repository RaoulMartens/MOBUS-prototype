import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDQxlxgipnT0OgVY_kxNL7opnMX9VTfEM8",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "mobus-6aaa9.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mobus-6aaa9",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "mobus-6aaa9.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "451827926532",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:451827926532:web:ecca071a400d5650299751"
};

try {
  console.log("Initializing Firebase app...");
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  console.log("Firebase initialized successfully. Fetching sessions...");
  const snap = await getDocs(collection(db, "sessions"));
  console.log(`Success! Found ${snap.size} sessions.`);
  snap.forEach(doc => {
    console.log("Session ID:", doc.id);
  });
  process.exit(0);
} catch (e) {
  console.error("Firebase init failed:", e);
  process.exit(1);
}
