import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";

// Manual .env file parsing
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");
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

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDQxlxgipnT0OgVY_kxNL7opnMX9VTfEM8",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "mobus-6aaa9.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mobus-6aaa9",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "mobus-6aaa9.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "451827926532",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:451827926532:web:ecca071a400d5650299751"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const activeFirestoreListeners = new Map();
const processingTokens = new Set(); // Prevent double trigger

function subscribeToSessionFirestore(sessionId) {
  if (activeFirestoreListeners.has(sessionId)) return;

  console.log(`[Bridge] Subscribing to Firestore updates for session: ${sessionId}`);
  const tokensRef = collection(db, "sessions", sessionId, "tokens");
  const unsubscribe = onSnapshot(tokensRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" || change.type === "modified") {
        const tokenId = change.doc.id;
        const data = change.doc.data();
        
        if (data.status === "pending_classification" && !processingTokens.has(tokenId)) {
          console.log(`[Bridge] Firestore change detected: token ${tokenId} in session ${sessionId} is pending classification.`);
          processingTokens.add(tokenId);
          
          const text = data.title || data.text || "";
          const description = data.description || "";
          
          // Gather other active tokens in session for context
          const otherTokens = [];
          snapshot.forEach(docSnap => {
            if (docSnap.id !== tokenId && docSnap.data().status !== "archived") {
              otherTokens.push({
                id: docSnap.id,
                title: docSnap.data().title || docSnap.data().text || "",
                description: docSnap.data().description || ""
              });
            }
          });
          
          classifyAndSaveToken(sessionId, tokenId, text, description, otherTokens)
            .catch(err => {
              console.error(`[Bridge] Firestore auto-classification failed for token ${tokenId}:`, err);
            })
            .finally(() => {
              processingTokens.delete(tokenId);
            });
        }
      }
    });

    // Trigger live reflection logic when token layout/groups change
    processLiveReflection(sessionId, snapshot);
  }, (err) => {
    console.error(`[Bridge] Firestore subscription failed for session ${sessionId}:`, err);
  });

  activeFirestoreListeners.set(sessionId, unsubscribe);
}

const PORT = 8787;
const sessions = new Map();
const clients = new Map();

const sendJson = (res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS, POST",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
};

const getSession = (sessionId) => {
  if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
  return sessions.get(sessionId);
};

const getTokensPayload = (sessionId) => ({
  tokens: Array.from(getSession(sessionId).entries()).map(([id, data]) => ({ id, data })),
});

const broadcast = (sessionId) => {
  const payload = `data: ${JSON.stringify(getTokensPayload(sessionId))}\n\n`;
  for (const res of clients.get(sessionId) || []) {
    res.write(payload);
  }
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
};

// Firestore REST conversion helper
const toFirestoreFields = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreFields) } };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, toFirestoreFields(item)])
        ),
      },
    };
  }
  return { stringValue: String(value) };
};

// Firestore REST PATCH helper
async function updateFirestoreToken(sessionId, tokenId, fields) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!projectId || !apiKey) {
    console.warn("[Bridge] Firestore keys missing in process.env, skipping REST sync.");
    return;
  }

  const fieldPaths = Object.keys(fields).map(key => `updateMask.fieldPaths=${key}`).join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(tokenId)}?${fieldPaths}&key=${apiKey}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, toFirestoreFields(value)])
      )
    })
  });

  if (!response.ok) {
    throw new Error(`Firestore PATCH failed (${response.status}): ${await response.text()}`);
  }
}

async function saveTokenUpdate(sessionId, tokenId, updateFields) {
  // 1. Update in local bridge memory
  const session = getSession(sessionId);
  const existing = session.get(tokenId) || {};
  session.set(tokenId, { ...existing, ...updateFields });
  broadcast(sessionId);

  // 2. Update in Firestore via SDK
  try {
    const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
    await updateDoc(docRef, updateFields);
    console.log(`[Bridge] Successfully synced token ${tokenId} classification to Firestore via SDK`);
  } catch (e) {
    console.error(`[Bridge] Could not update Firestore for token ${tokenId} via SDK:`, e.message);
    // fallback to REST
    try {
      await updateFirestoreToken(sessionId, tokenId, updateFields);
    } catch (restErr) {
      console.error(`[Bridge] REST fallback also failed for ${tokenId}:`, restErr.message);
    }
  }
}

async function markAsNeedsClassification(sessionId, tokenId) {
  const updateFields = {
    status: "needs_classification",
    updatedAt: new Date().toISOString()
  };
  await saveTokenUpdate(sessionId, tokenId, updateFields);
}

// Background Gemini API classification and validation
async function classifyAndSaveToken(sessionId, tokenId, text, description, otherTokens = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Bridge] GEMINI_API_KEY environment variable is not set.");
    await markAsNeedsClassification(sessionId, tokenId);
    return;
  }

  let contextPrompt = "";
  if (otherTokens && otherTokens.length > 0) {
    contextPrompt = `\nHere are the other active ideas in this brainstorming session. Use them to make SPECIFIC, REAL connections to these ideas in your possible_connections list if there are links (refer to them by their title):
${otherTokens.map(t => `- Title: "${t.title}", Description: "${t.description || "N/A"}"`).join("\n")}\n`;
  }

  const systemPrompt = `You are an AI observation and interpretation assistant for MOBUS, a system that displays and links ideas during creative group sessions.
Users step into the MOBUS for many different purposes (e.g., brainstorming, community project planning, design tasks, education, playful exploration, or open-ended creative work). 
Therefore, you are NOT a gatekeeper/moderator and you are NOT allowed to reject or block ideas. Every idea is valid because the user decides what matters. 

Your role is to observe, interpret the idea broadly, extract tags/metadata, and suggest possible relationships or cluster directions in a supportive manner.
If an idea seems short, vague, or unusual, do your best to interpret it metaphorically, creatively, or link it broadly. Never mark an idea as "invalid", "off_topic", or unusable. 

Return a confidence score reflecting how clear the idea's intent is, but never block the idea. 

Provide strict JSON output matching this schema. All text fields (title, summary, interpretation, cluster_name, creative_intent) must be in Dutch:
- title: Short Dutch title
- summary: One sentence Dutch summary
- interpretation: Broad Dutch interpretation of the idea's potential contribution to the session
- category: one of "ruimte", "interactie", "samenwerking", "technologie", "creativiteit", "proces", "onbekend"
- perspective: one of "UX", "technology", "business", "creativity", "unknown"
- tags: array of strings (at least 2-3 relevant tags)
- confidence: number between 0.0 and 1.0 (low for vague/unclear ideas, high for clear ideas)
- cluster_name: a broad, useful, session-related Dutch cluster name (e.g. "Samen ideeën ontwikkelen", "Ruimte en opstelling", "Gemeenschap en cultuur", "Spel en beweging", "AI en interactie")
- creative_intent: what this idea could contribute to a session
- possible_connections: array of strings explaining potential relationships in one short sentence each. If there are other ideas in the session, connect specifically to them.`;

  const prompt = `${systemPrompt}\n${contextPrompt}\nUser Idea:\nTitle: ${text || ""}\nDescription: ${description || ""}`;

  try {
    console.log(`[Bridge] Sending token ${tokenId} to Gemini...`);
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              summary: { type: "STRING" },
              interpretation: { type: "STRING" },
              category: { type: "STRING", enum: ["ruimte", "interactie", "samenwerking", "technologie", "creativiteit", "proces", "onbekend"] },
              perspective: { type: "STRING", enum: ["UX", "technology", "business", "creativity", "unknown"] },
              tags: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              confidence: { type: "NUMBER" },
              cluster_name: { type: "STRING" },
              creative_intent: { type: "STRING" },
              possible_connections: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: [
              "title",
              "summary",
              "interpretation",
              "category",
              "perspective",
              "tags",
              "confidence",
              "cluster_name",
              "creative_intent",
              "possible_connections"
            ]
          }
        }
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      throw new Error(`Gemini API returned status ${apiResponse.status}: ${errText}`);
    }

    const resJson = await apiResponse.json();
    const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error("No content returned from Gemini API");
    }

    const metadata = JSON.parse(generatedText);
    console.log(`[Bridge] Gemini classification success for ${tokenId}:`, metadata);
    
    const updateFields = {
      title: metadata.title || text,
      status: "active",
      ai_metadata: metadata,
      updatedAt: new Date().toISOString()
    };

    await saveTokenUpdate(sessionId, tokenId, updateFields);
  } catch (err) {
    console.error(`[Bridge] Gemini classification failed for token ${tokenId}:`, err);
    await markAsNeedsClassification(sessionId, tokenId);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, PATCH, OPTIONS, POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  // Match /api/sessions/:sessionId/tokens/:tokenId/classify
  const sessionsIdx = parts.indexOf("sessions");
  const isClassify = sessionsIdx !== -1 && 
                     parts[sessionsIdx + 2] === "tokens" && 
                     parts[sessionsIdx + 4] === "classify" && 
                     req.method === "POST";

  if (isClassify) {
    const sId = parts[sessionsIdx + 1];
    const tId = parts[sessionsIdx + 3];
    subscribeToSessionFirestore(sId);
    
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    
    const { text, description } = body;
    
    // Gather other active tokens in session for context
    const session = getSession(sId);
    const otherTokens = Array.from(session.entries())
      .filter(([id, data]) => id !== tId && data.status !== "archived")
      .map(([id, data]) => ({
        id,
        title: data.title || data.text || "",
        description: data.description || ""
      }));

    // Asynchronous classification in the background
    classifyAndSaveToken(sId, tId, text, description, otherTokens).catch(err => {
      console.error(`[Bridge] Background classification failed for token ${tId}:`, err);
    });
    
    sendJson(res, 200, { status: "pending" });
    return;
  }

  const [, sessionsSegment, sessionId, resource, tokenId] = parts;

  if (sessionsSegment !== "sessions" || !sessionId) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (resource === "events" && req.method === "GET") {
    subscribeToSessionFirestore(sessionId);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    if (!clients.has(sessionId)) clients.set(sessionId, new Set());
    clients.get(sessionId).add(res);
    res.write(`data: ${JSON.stringify(getTokensPayload(sessionId))}\n\n`);
    req.on("close", () => clients.get(sessionId)?.delete(res));
    return;
  }

  if (resource === "tokens" && !tokenId && req.method === "GET") {
    sendJson(res, 200, getTokensPayload(sessionId));
    return;
  }

  if (resource === "tokens" && tokenId && (req.method === "PUT" || req.method === "PATCH")) {
    subscribeToSessionFirestore(sessionId);
    const session = getSession(sessionId);
    const existing = session.get(tokenId) || {};
    const body = await readBody(req);
    session.set(tokenId, req.method === "PUT" ? body : { ...existing, ...body });
    broadcast(sessionId);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

const sessionTimeouts = new Map();
const lastProcessedSignatures = new Map();

const getSessionSignature = (tokens, clusters) => {
  const tokenIds = tokens.map(t => t.id).sort().join(",");
  const clusterSigs = clusters.map(c => c.map(t => t.id).sort().join("-")).sort().join("|");
  return `${tokenIds}::${clusterSigs}`;
};

async function writeLiveInsightToFirestore(sessionId, insight) {
  try {
    const docRef = doc(db, "sessions", sessionId, "state", "insight");
    await setDoc(docRef, {
      ...insight,
      updatedAt: new Date().toISOString()
    });
    console.log(`[Bridge] Live insight written to Firestore for session ${sessionId}:`, insight.state);
  } catch (e) {
    console.error(`[Bridge] Failed to write live insight to Firestore for session ${sessionId}:`, e.message);
  }
}

async function generateLiveInsight(sessionId, allTokens, clusters) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Bridge] GEMINI_API_KEY environment variable is not set, skipping live insight generation.");
    return;
  }

  console.log(`[Bridge] Generating live insight for session ${sessionId} with ${allTokens.length} tokens and ${clusters.length} clusters...`);

  // Build context
  const ideasListText = allTokens.map(t => 
    `- ID: ${t.id}, Title: "${t.text}", Description: "${t.description || "N/A"}"`
  ).join("\n");

  const clustersText = clusters.length > 0 
    ? clusters.map((c, idx) => {
        const clusterName = c.find(t => t.ai_metadata?.cluster_name)?.ai_metadata?.cluster_name || "Algemeen";
        const clusterIdeas = c.map(t => `- "${t.text}" (ID: ${t.id}, Description: "${t.description || "N/A"}")`).join("\n  ");
        return `Cluster ${idx + 1} ("${clusterName}"):\n  ${clusterIdeas}`;
      }).join("\n\n")
    : "No manual clusters on the table yet.";

  const systemPrompt = `You are the MOBUS live reflection engine. You observe the constellation of ideas on a creative brainstorming table.
Your goal is to output a live insight or reflection prompt to be displayed on the Wall Screen, focusing on the connections, tensions, or synergies between these ideas.

Your role is to analyze the active ideas and manual clusters on the table, looking for:
1. **Tension & Contrast**: Ideas or clusters with contrasting views (e.g., high-tech vs. nature, individual control vs. community participation, speed vs. safety). Point out the tension and ask a question to bridge them.
2. **Synergy**: Ideas or clusters that complement each other and could be combined into a more powerful concept. Propose how they can reinforce each other.
3. **Gaps**: Spot an area that feels missing between two clusters or ideas (e.g., "You have ideas about tech and ideas about ethics, but nothing on how users give feedback. What is missing in between?").

Current Session Constellation:
Active Ideas:
${ideasListText}

Manual Clusters:
${clustersText}

Choose the most appropriate state and generate a response matching this schema:
- state: one of:
  * "standby" (if no meaningful relationships or groups can be found)
  * "suggestion" (if you see a potential relation, tension, synergy, or gap between two or more ideas. E.g. "Beide ideeën lijken te gaan over schermgebruik. Wat wil je hierin verbeteren?")
  * "reflection" (if a manual group has been formed and you want to ask a deep creative reflection question about it)
  * "summary" (if you want to summarize the core shared concept of a manual group)
- title: A short Dutch title (e.g. theme or name of the connection, max 4 words)
- message: The live insight text, question, or prompt in Dutch. Do NOT use static templates. Be organic, varied, and specific. Reflect on tension, contrasting views, opportunity, or underlying needs.
- themeLabel: An optional short Dutch category label (e.g. "Technologie", "Samenwerking", "Duurzaamheid")
- relatedIdeaIds: Array of token IDs (from the list of active ideas) involved in this suggestion or reflection. You MUST include the exact IDs so that we can highlight them on the screen.
- confidence: A number between 0.0 and 1.0.

Provide strict JSON output matching this schema. All text fields must be in Dutch.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: systemPrompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              state: { type: "STRING", enum: ["standby", "suggestion", "reflection", "summary"] },
              title: { type: "STRING" },
              message: { type: "STRING" },
              themeLabel: { type: "STRING" },
              relatedIdeaIds: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              confidence: { type: "NUMBER" }
            },
            required: ["state", "title", "message", "relatedIdeaIds", "confidence"]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error status ${response.status}`);
    }

    const resJson = await response.json();
    const generatedText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) throw new Error("Empty response");

    const insight = JSON.parse(generatedText);
    console.log(`[Bridge] Generated Live Insight for session ${sessionId}:`, JSON.stringify(insight, null, 2));
    await writeLiveInsightToFirestore(sessionId, insight);
  } catch (err) {
    console.error(`[Bridge] Live insight generation failed for session ${sessionId}:`, err);
  }
}

function processLiveReflection(sessionId, snapshot) {
  const allTokens = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status !== "archived") {
      allTokens.push({
        id: docSnap.id,
        text: data.text || "",
        description: data.description || "",
        position: data.position || { x: 0, y: 0 },
        ai_metadata: data.ai_metadata || null
      });
    }
  });

  // Calculate clusters
  const SNAP_DISTANCE = 140;
  const getDistance = (p1, p2) => Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const adj = {};
  allTokens.forEach(t => { adj[t.id] = []; });
  for (let i = 0; i < allTokens.length; i++) {
    for (let j = i + 1; j < allTokens.length; j++) {
      if (getDistance(allTokens[i].position, allTokens[j].position) < SNAP_DISTANCE) {
        adj[allTokens[i].id].push(allTokens[j].id);
        adj[allTokens[j].id].push(allTokens[i].id);
      }
    }
  }

  const visited = new Set();
  const clusters = [];
  allTokens.forEach(t => {
    if (visited.has(t.id)) return;
    const comp = [];
    const queue = [t.id];
    visited.add(t.id);
    while (queue.length > 0) {
      const cid = queue.shift();
      const tk = allTokens.find(x => x.id === cid);
      if (tk) comp.push(tk);
      (adj[cid] || []).forEach(nid => {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push(nid);
        }
      });
    }
    if (comp.length >= 2) clusters.push(comp);
  });

  const sig = getSessionSignature(allTokens, clusters);
  const lastSig = lastProcessedSignatures.get(sessionId);

  if (sig === lastSig) return;

  if (sessionTimeouts.has(sessionId)) {
    clearTimeout(sessionTimeouts.get(sessionId));
  }

  if (allTokens.length < 2) {
    lastProcessedSignatures.set(sessionId, sig);
    writeLiveInsightToFirestore(sessionId, {
      state: "standby",
      title: "",
      message: "",
      themeLabel: "",
      relatedIdeaIds: [],
      confidence: 0.0
    });
    return;
  }

  const timeout = setTimeout(() => {
    lastProcessedSignatures.set(sessionId, sig);
    generateLiveInsight(sessionId, allTokens, clusters);
  }, 3500);

  sessionTimeouts.set(sessionId, timeout);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MOBUS local bridge listening on http://0.0.0.0:${PORT}`);
});

