import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQxlxgipnT0OgVY_kxNL7opnMX9VTfEM8",
  authDomain: "mobus-6aaa9.firebaseapp.com",
  projectId: "mobus-6aaa9",
  storageBucket: "mobus-6aaa9.firebasestorage.app",
  messagingSenderId: "451827926532",
  appId: "1:451827926532:web:ecca071a400d5650299751"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sessionId = "mobus-7192";

async function dump() {
  const tokensRef = collection(db, "sessions", sessionId, "tokens");
  const snap = await getDocs(tokensRef);
  console.log(`Tokens count: ${snap.size}`);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`${docSnap.id}: "${data.title || data.text}" at (${Math.round(data.position?.x)}, ${Math.round(data.position?.y)})`);
  });
  process.exit(0);
}

dump().catch(console.error);
