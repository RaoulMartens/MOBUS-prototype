import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

  // 2. Update in Firestore via REST (optional/fallback)
  try {
    await updateFirestoreToken(sessionId, tokenId, updateFields);
    console.log(`[Bridge] Successfully synced token ${tokenId} classification to Firestore`);
  } catch (e) {
    console.error(`[Bridge] Could not update Firestore for token ${tokenId} via REST:`, e.message);
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
async function classifyAndSaveToken(sessionId, tokenId, text, description) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Bridge] GEMINI_API_KEY environment variable is not set.");
    await markAsNeedsClassification(sessionId, tokenId);
    return;
  }

  const systemPrompt = `You are an AI classification and validation assistant for MOBUS, a system that clusters ideas for workshops.
You must first validate the user's input before classifying it.

Validation Rules:
1. Too Short: If the input has fewer than 8 meaningful characters (excluding spaces/punctuation), set validation_status to "too_short".
2. Too Vague: If the input consists of random letters (e.g. "ffgg", "asdf"), gibberish, single words with no context, or has no clear meaning, set validation_status to "too_vague".
3. Off Topic: If the input is completely unrelated to MOBUS, creative collaboration, interaction, space, learning, research, or idea development, set validation_status to "off_topic".
4. Not An Idea: If the input is just greeting, swearing, or non-idea chat (e.g. "hallo", "test"), set validation_status to "not_an_idea".
5. Valid: If it is a usable creative idea with sufficient context, set validation_status to "valid".

If validation_status is NOT "valid":
- set is_usable_idea to false.
- set should_cluster to false.
- set category to "onbekend".
- set perspective to "unknown".
- set confidence to a value below 0.4.
- set cluster_name to "null".
- set user_friendly_feedback to a helpful, friendly Dutch message asking the user to add more context (e.g., "Dit idee is nog te vaag om te koppelen. Voeg iets meer context toe via je telefoon.").

If validation_status is "valid":
- set is_usable_idea to true.
- set should_cluster to true.
- set category to one of: "ruimte", "interactie", "samenwerking", "technologie", "creativiteit", "proces", "onbekend".
- set perspective to one of: "UX", "technology", "business", "creativity", "unknown".
- set confidence to a value between 0.4 and 1.0.
- set user_friendly_feedback to a positive Dutch validation message.
- set cluster_name to a broad, useful, session-related Dutch cluster name. Avoid strange names. Use names like: "Samen ideeën ontwikkelen", "Ruimte en opstelling", "AI als creatieve prikkel", "Reflectie en overzicht", "Interacties op de tafel".

Provide strict JSON output matching the schema. All text fields (title, summary, user_friendly_feedback, cluster_name, creative_intent) must be in Dutch.`;

  const prompt = `${systemPrompt}\n\nUser Idea:\nTitle: ${text || ""}\nDescription: ${description || ""}`;

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
              is_usable_idea: { type: "BOOLEAN" },
              validation_status: { type: "STRING", enum: ["valid", "too_vague", "too_short", "off_topic", "not_an_idea"] },
              user_friendly_feedback: { type: "STRING" },
              title: { type: "STRING" },
              summary: { type: "STRING" },
              category: { type: "STRING", enum: ["ruimte", "interactie", "samenwerking", "technologie", "creativiteit", "proces", "onbekend"] },
              perspective: { type: "STRING", enum: ["UX", "technology", "business", "creativity", "unknown"] },
              tags: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              confidence: { type: "NUMBER" },
              should_cluster: { type: "BOOLEAN" },
              cluster_name: { type: "STRING" },
              creative_intent: { type: "STRING" },
              possible_connections: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: [
              "is_usable_idea",
              "validation_status",
              "user_friendly_feedback",
              "title",
              "summary",
              "category",
              "perspective",
              "tags",
              "confidence",
              "should_cluster",
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
    
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }
    
    const { text, description } = body;
    
    // Asynchronous classification in the background
    classifyAndSaveToken(sId, tId, text, description).catch(err => {
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MOBUS local bridge listening on http://0.0.0.0:${PORT}`);
});

