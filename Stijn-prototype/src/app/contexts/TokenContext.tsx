import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../../../../src/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch
} from 'firebase/firestore';

export interface Token {
  id: string;
  text: string;
  description?: string;
  clusterId: string | null;
  position: { x: number; y: number };
  createdAt: string;
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
  addToken: (text: string, position: { x: number; y: number }, description?: string) => Promise<void>;
  updateTokenPosition: (id: string, position: { x: number; y: number }) => Promise<void>;
  updateTokenText: (id: string, text: string) => Promise<void>;
  updateTokenDescription: (id: string, description: string) => Promise<void>;
  deleteToken: (id: string) => Promise<void>;
  deleteAllTokens: () => Promise<void>;
  createCluster: (name: string, tokenIds: string[]) => Promise<void>;
  addTokenToCluster: (tokenId: string, clusterId: string) => Promise<void>;
  removeTokenFromCluster: (tokenId: string) => Promise<void>;
  addEvent: (type: TokenEvent['type'], message: string) => Promise<void>;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

// Helper to determine the session ID
const getSessionId = (): string => {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSession = urlParams.get("sessionId");
  if (urlSession) {
    localStorage.setItem("sessionId", urlSession);
    return urlSession;
  }
  const storedSession = localStorage.getItem("sessionId");
  if (storedSession) return storedSession;
  return "mobus-tafel-88"; // default matching simulated scanner
};

const sessionId = getSessionId();

export function TokenProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);

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
          if (data.status === "archived" || data.archived === true) return;

          fetchedTokens.push({
            id: docSnap.id,
            text: data.title || data.text || "",
            description: data.description || "",
            clusterId: data.clusterId !== undefined ? data.clusterId : (data.cluster || null),
            position: data.position && typeof data.position.x === 'number' && typeof data.position.y === 'number'
              ? { x: data.position.x, y: data.position.y }
              : { x: 300 + Math.random() * 400, y: 200 + Math.random() * 300 },
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
          });
        });

        setTokens(fetchedTokens);
        setBackendConnected(true);
        setLoading(false);
        localStorage.setItem("tokens", JSON.stringify(fetchedTokens));
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

    return () => {
      unsubscribeIdeas();
      unsubscribeClusters();
      unsubscribeEvents();
    };
  }, []);

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
      clusterId: null,
      cluster: null,
      position: position,
      status: "active",
      archived: false,
      source: "table",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(docRef, payload);
      await addEvent("created", `New token "${text}" created`);
    } catch (error) {
      console.error("Error adding token:", error);
    }
  };

  const updateTokenPosition = async (id: string, position: { x: number; y: number }) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    try {
      await setDoc(docRef, { position, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.error("Error updating token position:", error);
    }
  };

  const updateTokenText = async (id: string, text: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    try {
      await setDoc(docRef, { title: text, text, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.error("Error updating token text:", error);
    }
  };

  const updateTokenDescription = async (id: string, description: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    try {
      await setDoc(docRef, { description, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
      console.error("Error updating token description:", error);
    }
  };

  const deleteToken = async (id: string) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", id);
    try {
      const token = tokens.find((t) => t.id === id);
      const label = token?.text || "Unknown";
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

  return (
    <TokenContext.Provider
      value={{
        tokens,
        clusters,
        events,
        loading,
        backendConnected,
        addToken,
        updateTokenPosition,
        updateTokenText,
        updateTokenDescription,
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
