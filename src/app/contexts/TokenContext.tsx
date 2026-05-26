import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db } from '../../firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { subscribeLocalBridge, updateLocalBridgeToken, classifyTokenOnBridge, saveTokenToLocalBridge } from '../utils/localBridge';

export interface Token {
  id: string;
  text: string;
  description?: string;
  drawingDataUrl?: string | null;
  drawingPath?: string | null;
  clusterId: string | null;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  createdAt: string;
  status?: string;
  ai_metadata?: {
    title: string;
    summary: string;
    interpretation?: string;
    category: string;
    perspective: string;
    tags: string[];
    confidence: number;
    cluster_name?: string | null;
    creative_intent: string;
    possible_connections: string[];
  } | null;
}

export interface Cluster {
  id: string;
  name: string;
  tokenIds: string[];
  color: string;
}

export interface TokenEvent {
  id: string;
  type: 'created' | 'moved' | 'clustered' | 'suggestion';
  message: string;
  timestamp: string;
}

interface TokenContextType {
  tokens: Token[];
  clusters: Cluster[];
  events: TokenEvent[];
  loading: boolean;
  backendConnected: boolean;
  sessionId: string;
  activeRelation: { sourceId: string; targetId: string } | null;
  setActiveRelation: (relation: { sourceId: string; targetId: string } | null) => Promise<void>;
  updateSessionId: (id: string) => void;
  addToken: (text: string, position: { x: number; y: number }, description?: string) => Promise<void>;
  updateTokenPosition: (id: string, position: { x: number; y: number }) => Promise<void>;
  updateTokenRotation: (id: string, rotation: number) => Promise<void>;
  updateTokenScale: (id: string, scale: number) => Promise<void>;
  updateTokenText: (id: string, text: string) => Promise<void>;
  updateTokenDescription: (id: string, description: string) => Promise<void>;
  archiveToken: (id: string) => Promise<void>;
  deleteToken: (id: string) => Promise<void>;
  deleteAllTokens: () => Promise<void>;
  createCluster: (name: string, tokenIds: string[]) => Promise<void>;
  addTokenToCluster: (tokenId: string, clusterId: string) => Promise<void>;
  removeTokenFromCluster: (tokenId: string) => Promise<void>;
  addEvent: (type: TokenEvent['type'], message: string) => Promise<void>;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

const normalizeSessionId = (value: string): string => {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `mobus-${trimmed}` : trimmed;
};

// Helper to determine the session ID
const getSessionId = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSession = urlParams.get("sessionId");
  if (urlSession) {
    const normalized = normalizeSessionId(urlSession);
    localStorage.setItem("sessionId", normalized);
    return normalized;
  }
  const storedSession = localStorage.getItem("sessionId");
  if (storedSession) return normalizeSessionId(storedSession);
  return "mobus-tafel-88"; // default matching simulated scanner
};

const normalizeToken = (id: string, data: any): Token | null => {
  if (data.status === "archived" || data.archived === true) return null;
  const text = data.title || data.text || "";
  if (!text.trim()) return null;

  return {
    id,
    text,
    description: data.description || "",
    drawingDataUrl: data.drawingDataUrl || data.sketch || null,
    drawingPath: data.drawingPath || null,
    clusterId: data.clusterId !== undefined ? data.clusterId : (data.cluster || null),
    position: data.position && typeof data.position.x === 'number' && typeof data.position.y === 'number'
      ? { x: data.position.x, y: data.position.y }
      : { x: 300 + Math.random() * 400, y: 200 + Math.random() * 300 },
    rotation: typeof data.rotation === 'number' ? data.rotation : 0,
    scale: typeof data.scale === 'number' ? data.scale : 1,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
    status: data.status || "active",
    ai_metadata: data.ai_metadata || null,
  };
};

const mergeTokens = (firestoreTokens: Token[], bridgeTokens: Token[]) => {
  const merged = new Map<string, Token>();
  firestoreTokens.forEach(token => merged.set(token.id, token));
  bridgeTokens.forEach(token => merged.set(token.id, token));
  return Array.from(merged.values());
};

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [sessionId, setSessionId] = useState(() => getSessionId());
  const [activeRelation, setActiveRelationState] = useState<{ sourceId: string; targetId: string } | null>(null);
  const firestoreTokensRef = useRef<Token[]>([]);
  const bridgeTokensRef = useRef<Token[]>([]);

  const updateSessionId = (id: string) => {
    const normalized = normalizeSessionId(id);
    localStorage.setItem("sessionId", normalized);
    setSessionId(normalized);
  };

  // Sync with Firestore in real-time
  useEffect(() => {
    console.log(`[TokenContext] Subscribing to session: ${sessionId}`);
    setLoading(true);

    // 1. Subscribe to ideas (tokens)
    const ideasRef = collection(db, "sessions", sessionId, "tokens");
    const unsubscribeIdeas = onSnapshot(
      ideasRef,
      (snapshot) => {
        const fetchedTokens: Token[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const token = normalizeToken(docSnap.id, data);
          if (token) fetchedTokens.push(token);
        });

        firestoreTokensRef.current = fetchedTokens;
        const mergedTokens = mergeTokens(fetchedTokens, bridgeTokensRef.current);
        setTokens(mergedTokens);
        setBackendConnected(true);
        setLoading(false);
        localStorage.setItem("tokens", JSON.stringify(mergedTokens));
      },
      (error) => {
        console.error("Firestore tokens sync error:", error);
        setBackendConnected(false);
        setLoading(false);
        // Fallback to local storage
        const stored = localStorage.getItem("tokens");
        if (stored) setTokens(JSON.parse(stored));
      }
    );

    // 2. Subscribe to clusters
    const clustersRef = collection(db, "sessions", sessionId, "clusters");
    const unsubscribeClusters = onSnapshot(
      clustersRef,
      (snapshot) => {
        const fetchedClusters: Cluster[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedClusters.push({
            id: docSnap.id,
            name: data.name || "",
            tokenIds: data.tokenIds || [],
            color: data.color || "#3b82f6",
          });
        });
        setClusters(fetchedClusters);
        localStorage.setItem("clusters", JSON.stringify(fetchedClusters));
      },
      (error) => {
        console.error("Firestore clusters sync error:", error);
        const stored = localStorage.getItem("clusters");
        if (stored) setClusters(JSON.parse(stored));
      }
    );

    // 3. Subscribe to events
    const eventsRef = collection(db, "sessions", sessionId, "events");
    const unsubscribeEvents = onSnapshot(
      eventsRef,
      (snapshot) => {
        const fetchedEvents: TokenEvent[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetchedEvents.push({
            id: docSnap.id,
            type: data.type || "created",
            message: data.message || "",
            timestamp: data.timestamp || new Date().toISOString(),
          });
        });
        // Sort events by timestamp desc
        fetchedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setEvents(fetchedEvents);
        localStorage.setItem("events", JSON.stringify(fetchedEvents));
      },
      (error) => {
        console.error("Firestore events sync error:", error);
        const stored = localStorage.getItem("events");
        if (stored) setEvents(JSON.parse(stored));
      }
    );

    // 4. Subscribe to active relation state
    const activeRelationRef = doc(db, "sessions", sessionId, "state", "activeRelation");
    const unsubscribeActiveRelation = onSnapshot(
      activeRelationRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.sourceId && data.targetId) {
            setActiveRelationState({ sourceId: data.sourceId, targetId: data.targetId });
          } else {
            setActiveRelationState(null);
          }
        } else {
          setActiveRelationState(null);
        }
      },
      (error) => {
        console.error("Firestore active relation sync error:", error);
      }
    );

    const unsubscribeLocalBridge = subscribeLocalBridge(sessionId, (items) => {
      const localTokens = items
        .map(({ id, data }) => normalizeToken(id, data))
        .filter((token): token is Token => token !== null);
      bridgeTokensRef.current = localTokens;
      const mergedTokens = mergeTokens(firestoreTokensRef.current, localTokens);
      setTokens(mergedTokens);
      setLoading(false);
      localStorage.setItem("tokens", JSON.stringify(mergedTokens));
    });

    return () => {
      unsubscribeIdeas();
      unsubscribeClusters();
      unsubscribeEvents();
      unsubscribeActiveRelation();
      unsubscribeLocalBridge();
    };
  }, [sessionId]);

  const addToken = async (text: string, position: { x: number; y: number }, description?: string) => {
    const tokenId = `token-${Date.now()}-${Math.random()}`;
    const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);

    const payload = {
      id: tokenId,
      tokenId: tokenId,
      seedId: tokenId,
      title: text,
      text: text,
      description: description || "",
      drawingDataUrl: null,
      drawingPath: null,
      clusterId: null,
      cluster: null,
      position: position,
      rotation: 0,
      scale: 1,
      status: "pending_classification",
      archived: false,
      source: "table",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      // 1. Write to local bridge first
      try {
        await saveTokenToLocalBridge(sessionId, tokenId, payload);
      } catch (bridgeErr) {
        console.warn("Failed to write to local bridge:", bridgeErr);
      }

      // 2. Write to Firestore
      await setDoc(docRef, payload);
      await addEvent("created", `New token "${text}" created`);
      
      // Trigger classification asynchronously
      classifyTokenOnBridge(sessionId, tokenId, text, description || "").catch(err => {
        console.error("Failed to classify token on bridge:", err);
      });
    } catch (error) {
      console.error("Error adding token:", error);
    }
  };

  const updateTokenPosition = async (id: string, position: { x: number; y: number }) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const patch = { position, updatedAt: new Date().toISOString() };
    
    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error updating local bridge position:", bridgeError);
    }

    try {
      await updateDoc(docRef, patch);
    } catch (error) {
      console.error("Error updating token position:", error);
    }
  };

  const updateTokenRotation = async (id: string, rotation: number) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const patch = { rotation, updatedAt: new Date().toISOString() };

    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error updating local bridge rotation:", bridgeError);
    }

    try {
      await updateDoc(docRef, patch);
    } catch (error) {
      console.error("Error updating token rotation:", error);
    }
  };

  const updateTokenScale = async (id: string, scale: number) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const patch = { scale, updatedAt: new Date().toISOString() };

    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error updating local bridge scale:", bridgeError);
    }

    try {
      await updateDoc(docRef, patch);
    } catch (error) {
      console.error("Error updating token scale:", error);
    }
  };

  const updateTokenText = async (id: string, text: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const patch = { title: text, text, updatedAt: new Date().toISOString() };

    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error updating local bridge text:", bridgeError);
    }

    try {
      await setDoc(docRef, patch, { merge: true });
    } catch (error) {
      console.error("Error updating token text:", error);
    }
  };

  const updateTokenDescription = async (id: string, description: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const patch = { description, updatedAt: new Date().toISOString() };

    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error updating local bridge description:", bridgeError);
    }

    try {
      await setDoc(docRef, patch, { merge: true });
    } catch (error) {
      console.error("Error updating token description:", error);
    }
  };

  const archiveToken = async (id: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const token = tokens.find((t) => t.id === id);
    const label = token?.text || "Unknown";
    const patch = {
      archived: true,
      status: "archived",
      clusterId: null,
      cluster: null,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateLocalBridgeToken(sessionId, id, patch);
    } catch (bridgeError) {
      console.warn("Error archiving local bridge token:", bridgeError);
    }

    try {
      await setDoc(docRef, patch, { merge: true });
      await addEvent("moved", `Token "${label}" parked outside active table space`);
    } catch (error) {
      console.error("Error archiving token:", error);
    }
  };

  const deleteToken = async (id: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    const token = tokens.find((t) => t.id === id);
    const label = token?.text || "Unknown";

    try {
      await updateLocalBridgeToken(sessionId, id, { status: "deleted", archived: true });
    } catch (bridgeError) {
      console.warn("Error updating local bridge for deletion:", bridgeError);
    }

    try {
      await deleteDoc(docRef);
      await addEvent("moved", `Token "${label}" deleted`);
    } catch (error) {
      console.error("Error deleting token:", error);
    }
  };

  const deleteAllTokens = async () => {
    try {
      const batch = writeBatch(db);

      // Delete all ideas
      const ideasSnapshot = await getDocs(collection(db, "sessions", sessionId, "tokens"));
      ideasSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // Delete all clusters
      const clustersSnapshot = await getDocs(collection(db, "sessions", sessionId, "clusters"));
      clustersSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // Delete all events
      const eventsSnapshot = await getDocs(collection(db, "sessions", sessionId, "events"));
      eventsSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      await addEvent("moved", "All tokens cleared");
    } catch (error) {
      console.error("Error clearing session data:", error);
    }
  };

  const createCluster = async (name: string, tokenIds: string[]) => {
    const clusterId = `cluster-${Date.now()}`;
    const colors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6b7280"];
    const color = colors[clusters.length % colors.length];

    const clusterRef = doc(db, "sessions", sessionId, "clusters", clusterId);

    try {
      await setDoc(clusterRef, {
        id: clusterId,
        name,
        tokenIds: tokenIds || [],
        color,
      });

      if (tokenIds && tokenIds.length > 0) {
        const batch = writeBatch(db);
        tokenIds.forEach((tokenId) => {
          const tokenRef = doc(db, "sessions", sessionId, "tokens", tokenId);
          batch.set(tokenRef, { clusterId, cluster: clusterId, updatedAt: new Date().toISOString() }, { merge: true });
        });
        await batch.commit();
      }

      await addEvent("clustered", `${tokenIds.length} tokens clustered into "${name}"`);
    } catch (error) {
      console.error("Error creating cluster:", error);
    }
  };

  const addTokenToCluster = async (tokenId: string, clusterId: string) => {
    const token = tokens.find((t) => t.id === tokenId);
    const cluster = clusters.find((c) => c.id === clusterId);

    try {
      const batch = writeBatch(db);

      // 1. Update token's cluster ID
      const tokenRef = doc(db, "sessions", sessionId, "tokens", tokenId);
      batch.set(tokenRef, { clusterId, cluster: clusterId, updatedAt: new Date().toISOString() }, { merge: true });

      // 2. Remove token from old cluster
      const oldClusterId = token?.clusterId;
      if (oldClusterId && oldClusterId !== clusterId) {
        const oldCluster = clusters.find((c) => c.id === oldClusterId);
        if (oldCluster) {
          const oldClusterRef = doc(db, "sessions", sessionId, "clusters", oldClusterId);
          batch.set(
            oldClusterRef,
            { tokenIds: oldCluster.tokenIds.filter((id) => id !== tokenId) },
            { merge: true }
          );
        }
      }

      // 3. Add token to new cluster
      if (cluster && !cluster.tokenIds.includes(tokenId)) {
        const newClusterRef = doc(db, "sessions", sessionId, "clusters", clusterId);
        batch.set(newClusterRef, { tokenIds: [...cluster.tokenIds, tokenId] }, { merge: true });
      }

      await batch.commit();

      if (token && cluster) {
        await addEvent("moved", `Token "${token.text}" added to "${cluster.name}"`);
      }
    } catch (error) {
      console.error("Error adding token to cluster:", error);
    }
  };

  const removeTokenFromCluster = async (tokenId: string) => {
    const token = tokens.find((t) => t.id === tokenId);
    const oldClusterId = token?.clusterId;
    if (!oldClusterId) return;

    try {
      const batch = writeBatch(db);

      // 1. Update token
      const tokenRef = doc(db, "sessions", sessionId, "tokens", tokenId);
      batch.set(tokenRef, { clusterId: null, cluster: null, updatedAt: new Date().toISOString() }, { merge: true });

      // 2. Update cluster
      const oldCluster = clusters.find((c) => c.id === oldClusterId);
      if (oldCluster) {
        const oldClusterRef = doc(db, "sessions", sessionId, "clusters", oldClusterId);
        batch.set(
          oldClusterRef,
          { tokenIds: oldCluster.tokenIds.filter((id) => id !== tokenId) },
          { merge: true }
        );
      }

      await batch.commit();
      await addEvent("moved", `Token removed from cluster`);
    } catch (error) {
      console.error("Error removing token from cluster:", error);
    }
  };

  const addEvent = async (type: TokenEvent["type"], message: string) => {
    const eventId = `event-${Date.now()}-${Math.random()}`;
    const eventRef = doc(db, "sessions", sessionId, "events", eventId);

    try {
      await setDoc(eventRef, {
        id: eventId,
        type,
        message,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error adding event:", error);
    }
  };

  const setActiveRelation = async (relation: { sourceId: string; targetId: string } | null) => {
    const activeRelationRef = doc(db, "sessions", sessionId, "state", "activeRelation");
    try {
      if (relation) {
        await setDoc(activeRelationRef, {
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(activeRelationRef, {
          sourceId: null,
          targetId: null,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error setting active relation:", error);
    }
  };

  return (
    <TokenContext.Provider
      value={{
        tokens,
        clusters,
        events,
        loading,
        backendConnected,
        sessionId,
        activeRelation,
        setActiveRelation,
        updateSessionId,
        addToken,
        updateTokenPosition,
        updateTokenRotation,
        updateTokenScale,
        updateTokenText,
        updateTokenDescription,
        archiveToken,
        deleteToken,
        deleteAllTokens,
        createCluster,
        addTokenToCluster,
        removeTokenFromCluster,
        addEvent,
      }}
    >
      {children}
    </TokenContext.Provider>
  );
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useTokens must be used within TokenProvider");
  }
  return context;
}
