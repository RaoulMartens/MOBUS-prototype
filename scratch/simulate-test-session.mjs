import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "firebase/firestore";
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
  appId: process.env.VITE_FIREBASE_APP_ID || "1:451827926532:web:ecca071a400d5550299751"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate random session ID
const rand = Math.floor(1000 + Math.random() * 9000);
const sessionId = `mobus-${rand}`;

console.log("=========================================");
console.log(`🚀 Starting Test Session: ${sessionId}`);
console.log("=========================================");
console.log("To view this session in the app, open these links in your browser:");
console.log(`👉 Table Screen: http://localhost:5173/table?sessionId=${sessionId}`);
console.log(`👉 Wall Screen:  http://localhost:5173/dev/wall?sessionId=${sessionId}`);
console.log(`👉 AI Monitor:   http://localhost:5173/dev/debug?sessionId=${sessionId}`);
console.log("=========================================\n");

async function runSimulation() {
  // 1. Wake up the bridge for this session
  console.log("[Simulation] Waking up the local bridge server for this session...");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    await fetch(`http://localhost:8787/api/sessions/${sessionId}/events`, { signal: controller.signal });
    clearTimeout(timeout);
    console.log("[Simulation] Local bridge woke up and subscribed to session!");
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log("[Simulation] Local bridge woke up (event connection initiated)!");
    } else {
      console.error("[Simulation] Could not reach local bridge server on port 8787. Make sure it is running!", err.message);
      process.exit(1);
    }
  }

  // 2. Set up Firestore listener to watch tokens and insights
  const tokens = {};
  const tokensRef = collection(db, "sessions", sessionId, "tokens");
  
  const unsubscribeTokens = onSnapshot(tokensRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const id = change.doc.id;
      const data = change.doc.data();
      if (change.type === "added") {
        tokens[id] = data;
        console.log(`[Firestore] New Token Added: "${data.title || data.text}" [Status: ${data.status}]`);
      } else if (change.type === "modified") {
        const oldStatus = tokens[id]?.status;
        tokens[id] = data;
        if (oldStatus === "pending_classification" && data.status === "active") {
          console.log(`\n🎉 [Firestore] Token "${data.title}" successfully classified by Gemini!`);
          console.log(`   - Category: ${data.ai_metadata?.category}`);
          console.log(`   - Perspective: ${data.ai_metadata?.perspective}`);
          console.log(`   - Summary: ${data.ai_metadata?.summary}`);
          console.log(`   - Tags: ${data.ai_metadata?.tags?.join(", ")}`);
          console.log(`   - Suggested cluster: "${data.ai_metadata?.cluster_name}"`);
          console.log(`   - Possible connections:`);
          data.ai_metadata?.possible_connections?.forEach(c => console.log(`     * ${c}`));
          console.log("");
        } else {
          console.log(`[Firestore] Token "${data.title || data.text}" updated (status: ${data.status}, pos: ${Math.round(data.position?.x)}, ${Math.round(data.position?.y)})`);
        }
      }
    });
  }, (err) => {
    console.error("[Firestore] Tokens snapshot listener encountered an error (this is expected if security rules restrict listing):", err.message);
  });

  const insightRef = doc(db, "sessions", sessionId, "state", "insight");
  const unsubscribeInsight = onSnapshot(insightRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log(`\n💡 [Firestore] Live Insight Updated!`);
      console.log(`   - State: ${data.state}`);
      console.log(`   - Title: "${data.title}"`);
      console.log(`   - Message: "${data.message}"`);
      console.log(`   - Related Ideas: ${data.relatedIdeaIds?.join(", ")}`);
      console.log(`   - Confidence: ${data.confidence}\n`);
    }
  }, (err) => {
    console.error("[Firestore] Insight snapshot listener encountered an error:", err.message);
  });

  // 3. Add 3 test tokens to the session
  const testIdeas = [
    {
      id: "token-test-1",
      title: "Slijm telefoon",
      text: "Slijm telefoon",
      description: "Een telefoon die gemaakt is van slijm en van vorm kan veranderen.",
      position: { x: 300, y: 300 }
    },
    {
      id: "token-test-2",
      title: "Quatro Telefoon",
      text: "Quatro Telefoon",
      description: "Een vierkante telefoon met vier schermen aan elke kant.",
      position: { x: 800, y: 300 }
    },
    {
      id: "token-test-3",
      title: "Digitale Pizzasnijder",
      text: "Digitale Pizzasnijder",
      description: "Een pizzasnijder die berekent hoe je de pizza perfect in gelijke delen snijdt.",
      position: { x: 1200, y: 500 }
    }
  ];

  console.log("\n[Simulation] Adding 3 test ideas to Firestore...");
  for (const idea of testIdeas) {
    const payload = {
      id: idea.id,
      tokenId: idea.id,
      seedId: idea.id,
      title: idea.title,
      text: idea.text,
      description: idea.description,
      drawingDataUrl: null,
      drawingPath: null,
      clusterId: null,
      cluster: null,
      position: idea.position,
      rotation: 0,
      scale: 1,
      status: "pending_classification",
      archived: false,
      source: "simulation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Write directly to Firestore, bridge listener will see it
    await setDoc(doc(db, "sessions", sessionId, "tokens", idea.id), payload);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 4. Wait for all 3 tokens to be classified
  console.log("\n[Simulation] Waiting for Gemini classification (approx. 5-10 seconds)...");
  let allClassified = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const tokenList = Object.values(tokens);
    if (tokenList.length === 3 && tokenList.every(t => t.status === "active" || t.status === "needs_classification")) {
      allClassified = true;
      break;
    }
  }

  if (!allClassified) {
    console.warn("[Simulation] Timed out waiting for classification. Proceeding anyway...");
  }

  // 5. Simulate dragging Token 1 closer to Token 2 to form a cluster
  console.log("\n[Simulation] Simulating drag: Moving 'Slijm telefoon' close to 'Quatro Telefoon' (distance < 140px)...");
  const token1DocRef = doc(db, "sessions", sessionId, "tokens", "token-test-1");
  await setDoc(token1DocRef, {
    position: { x: 700, y: 300 }, // Quatro is at x:800, y:300. Distance = 100px (< 140px)
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log("[Simulation] Waiting for cluster detection and live insight generation (approx. 10-12 seconds)...");
  await new Promise(resolve => setTimeout(resolve, 12000));

  console.log("\n[Simulation] Simulation run completed.");
  console.log("Press Ctrl+C to stop listening and exit the script.");
}

runSimulation().catch(console.error);
