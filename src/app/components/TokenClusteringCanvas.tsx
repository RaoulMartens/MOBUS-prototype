import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Token } from './Token';
import { useTokens } from '../contexts/TokenContext';
import { TableEmptyState } from './TableEmptyState';

interface CanvasToken {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  drawingDataUrl: string | null;
  rotation: number;
  scale: number;
  lastInteracted: number;
  status?: string;
  ai_metadata?: any;
}

interface AIPrompt {
  text: string;
  x: number;
  y: number;
  isCollapsed: boolean;
  targetId: string; // Token ID or 'cluster-x-y'
  createdAt: number;
}

const SNAP_DISTANCE = 140;
const PROXIMITY_DISTANCE = 220;
const TOP_RESTRICTED_AREA = 80;
const EDGE_ARCHIVE_DISTANCE = 72;

// Inspiring Dutch AI prompts designed to stimulate creativity without giving answers
const aiPromptsList = [
  "Wat als je deze ideeën juist níét combineert?",
  "Welke aanname zit hieronder?",
  "Draai dit idee eens om.",
  "Wat zou iemand uit een totaal andere discipline hierin zien?",
  "Welke twee ideeën botsen juist interessant?",
  "Maak dit idee expres slechter. Wat leer je daarvan?",
  "Wat is de absolute tegenpool van deze gedachte?",
  "Als dit idee een fysiek object was, hoe zou het aanvoelen?",
  "Welke onzichtbare maatschappelijke factor verbindt deze gedachten?"
];

// Helper to generate Dutch relation labels based on titles
const generateRelationLabel = (titleA: string, titleB: string): string => {
  const cleanA = titleA.toLowerCase();
  const cleanB = titleB.toLowerCase();

  if ((cleanA.includes('ai') || cleanA.includes('robot') || cleanA.includes('techno') || cleanA.includes('systeem')) &&
    (cleanB.includes('mens') || cleanB.includes('team') || cleanB.includes('crea') || cleanB.includes('ontwerp') || cleanB.includes('gevoel'))) {
    return "Hoe versterken menselijke intuïtie en technologie elkaar hier?";
  }
  if ((cleanB.includes('ai') || cleanB.includes('robot') || cleanB.includes('techno') || cleanB.includes('systeem')) &&
    (cleanA.includes('mens') || cleanA.includes('team') || cleanA.includes('crea') || cleanA.includes('ontwerp') || cleanA.includes('gevoel'))) {
    return "Hoe versterken menselijke intuïtie en technologie elkaar hier?";
  }

  if (cleanA.includes('ethiek') || cleanA.includes('veilig') || cleanA.includes('risico') || cleanB.includes('ethiek') || cleanB.includes('veilig') || cleanB.includes('risico')) {
    return "Waar ligt de morele grens tussen deze twee gedachten?";
  }

  if (cleanA.includes('samen') || cleanA.includes('deelm') || cleanB.includes('samen') || cleanB.includes('deelm')) {
    return "Hoe verbindt dit de gemeenschappelijke belangen?";
  }

  const suggestions = [
    "Wat ontstaat er op het snijvlak van deze gedachten?",
    "Hoe beïnvloeden deze twee perspectieven elkaar?",
    "Welk onderliggend probleem lossen deze samen op?",
    "Welke nieuwe vraag roept deze combinatie op?",
    "Wat is het grootste verschil tussen deze twee?",
    "Hoe verhouden deze ideeën zich tot de praktijk?",
    "Wat ontbreekt er nog in de verbinding tussen deze twee?",
    "Welk derde idee is nodig om deze link logisch te maken?"
  ];

  const index = (titleA.length + titleB.length) % suggestions.length;
  return suggestions[index];
};

interface SuggestedRelation {
  sourceId: string;
  targetId: string;
  score: number;
  reason?: string;
  state: "suggested" | "confirmed" | "dismissed";
}

const STOP_WORDS = new Set([
  'aan', 'als', 'bij', 'dat', 'de', 'deze', 'die', 'dit', 'door', 'een', 'en',
  'er', 'het', 'hier', 'hoe', 'in', 'is', 'kan', 'met', 'naar', 'niet', 'nog',
  'om', 'op', 'te', 'tot', 'uit', 'van', 'voor', 'wat', 'we', 'wel', 'zijn',
  'the', 'and', 'for', 'from', 'that', 'this', 'with',
]);

const THEME_RULES = [
  {
    label: 'Mensgerichte Technologie',
    keywords: ['ai', 'robot', 'technologie', 'tech', 'digitaal', 'systeem', 'data', 'automatisering', 'mens', 'team'],
  },
  {
    label: 'Veilige en Eerlijke Keuzes',
    keywords: ['ethiek', 'veilig', 'risico', 'privacy', 'vertrouwen', 'eerlijk', 'transparant', 'controle'],
  },
  {
    label: 'Samenwerking en Eigenaarschap',
    keywords: ['samen', 'team', 'groep', 'community', 'deelname', 'participatie', 'co-creatie', 'eigenaarschap'],
  },
  {
    label: 'Duurzame Impact',
    keywords: ['duurzaam', 'milieu', 'impact', 'circulair', 'energie', 'klimaat', 'toekomst', 'sociaal'],
  },
  {
    label: 'Leren en Experimenteren',
    keywords: ['leren', 'onderwijs', 'training', 'experiment', 'prototype', 'testen', 'feedback', 'onderzoek'],
  },
  {
    label: 'Toegankelijke Ervaring',
    keywords: ['toegankelijk', 'ervaring', 'gebruiker', 'gebruikers', 'interface', 'simpel', 'duidelijk', 'inclusief'],
  },
];

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= 2 && !STOP_WORDS.has(word));
}

function calculateSemanticScore(textA: string, descA: string, textB: string, descB: string): number {
  const wordsA = normalizeWords(`${textA} ${descA}`);
  const wordsB = normalizeWords(`${textB} ${descB}`);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  // Jaccard similarity of normalized words
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let intersection = 0;
  setA.forEach(w => {
    if (setB.has(w)) intersection++;
  });
  const union = setA.size + setB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;

  // Thematic rules match
  let thematicMatch = false;
  for (const theme of THEME_RULES) {
    const hasA = theme.keywords.some(keyword => 
      wordsA.some(w => w.includes(keyword) || keyword.includes(w))
    );
    const hasB = theme.keywords.some(keyword => 
      wordsB.some(w => w.includes(keyword) || keyword.includes(w))
    );
    if (hasA && hasB) {
      thematicMatch = true;
      break;
    }
  }

  // Base score calculation
  let score = jaccard * 0.65;
  if (thematicMatch) score += 0.45;

  // Boost exact title keyword overlap
  const titleA = normalizeWords(textA);
  const titleB = normalizeWords(textB);
  titleA.forEach(w => {
    if (titleB.includes(w)) score += 0.25;
  });

  return Math.min(score, 1.0);
}

export function TokenClusteringCanvas() {
  const {
    tokens: dbTokens,
    updateTokenPosition,
    updateTokenRotation,
    updateTokenScale,
    archiveToken,
    loading,
    backendConnected,
    sessionId,
    addToken,
    activeRelation,
    setActiveRelation
  } = useTokens();

  const [canvasTokens, setCanvasTokens] = useState<CanvasToken[]>([]);
  const [tokenCounter, setTokenCounter] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasTokensRef = useRef<CanvasToken[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Progressive Disclosure states
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MOBUS - Tafelscherm";
  }, []);

  // ripples for satisfying snap/unsnap animations
  const [ripples, setRipples] = useState<Array<{
    id: string;
    x: number;
    y: number;
    type: 'snap' | 'unsnap';
    createdAt: number;
  }>>([]);
  const [suggestionLines, setSuggestionLines] = useState<Array<{
    id: string;
    sourceId: string;
    targetId: string;
    score: number;
    currentOpacity: number;
    isLeaving: boolean;
  }>>([]);
  const prevConnectionsRef = useRef<string[]>([]);
  const isFirstRender = useRef(true);
  const [archiveCandidateId, setArchiveCandidateId] = useState<string | null>(null);
  const [archiveFeedback, setArchiveFeedback] = useState<string | null>(null);
  const pendingTokenPersistRef = useRef<Record<string, {
    position?: { x: number; y: number };
    rotation?: number;
    scale?: number;
  }>>({});
  const persistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };

  const clusterableCanvasTokens = useMemo(() => {
    return canvasTokens;
  }, [canvasTokens]);

  const getConnections = () => {
    const connections: Array<{ from: string; to: string; distance: number }> = [];
    const proximityLines: Array<{ from: string; to: string; distance: number }> = [];
    const connectedTokenIds = new Set<string>();

    canvasTokens.forEach((token, i) => {
      canvasTokens.slice(i + 1).forEach((otherToken) => {
        const distance = getDistance(token.x, token.y, otherToken.x, otherToken.y);
        if (distance < SNAP_DISTANCE) {
          connections.push({ from: token.id, to: otherToken.id, distance });
          connectedTokenIds.add(token.id);
          connectedTokenIds.add(otherToken.id);
        } else if (distance < PROXIMITY_DISTANCE) {
          proximityLines.push({ from: token.id, to: otherToken.id, distance });
        }
      });
    });

    return { connections, proximityLines, connectedTokenIds };
  };

  const { connections, proximityLines, connectedTokenIds } = getConnections();
  const connectionSignature = connections
    .map(({ from, to }) => [from, to].sort().join(':'))
    .sort()
    .join('|');

  useEffect(() => {
    if (loading) return;

    const currentKeys = connections.map(({ from, to }) => getRelationKey(from, to));

    if (isFirstRender.current) {
      prevConnectionsRef.current = currentKeys;
      isFirstRender.current = false;
      return;
    }

    const prevKeys = prevConnectionsRef.current;
    const newKeys = currentKeys.filter(k => !prevKeys.includes(k));
    const removedKeys = prevKeys.filter(k => !currentKeys.includes(k));

    const newRipples: Array<{
      id: string;
      x: number;
      y: number;
      type: 'snap' | 'unsnap';
      createdAt: number;
    }> = [];

    // All snaps/unsnaps should be rippled now that initial state is bypassed
    if (true) {
      newKeys.forEach(key => {
        const [id1, id2] = key.split('-');
        const t1 = canvasTokensRef.current.find(t => t.id === id1);
        const t2 = canvasTokensRef.current.find(t => t.id === id2);
        if (t1 && t2) {
          newRipples.push({
            id: `snap-${key}-${Date.now()}-${Math.random()}`,
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2,
            type: 'snap',
            createdAt: Date.now()
          });
        }
      });

      removedKeys.forEach(key => {
        const [id1, id2] = key.split('-');
        const t1 = canvasTokensRef.current.find(t => t.id === id1);
        const t2 = canvasTokensRef.current.find(t => t.id === id2);
        if (t1 && t2) {
          newRipples.push({
            id: `unsnap-${key}-${Date.now()}-${Math.random()}`,
            x: (t1.x + t2.x) / 2,
            y: (t1.y + t2.y) / 2,
            type: 'unsnap',
            createdAt: Date.now()
          });
        }
      });
    }

    if (newRipples.length > 0) {
      setRipples(prev => [...prev, ...newRipples]);
      setTimeout(() => {
        const now = Date.now();
        setRipples(prev => prev.filter(r => now - r.createdAt < 800));
      }, 900);
    }

    prevConnectionsRef.current = currentKeys;
  }, [connectionSignature, loading]);

  const getDrawingThumbnailIds = () => {
    const thumbnailIds = new Set<string>();
    const adjacency: Record<string, string[]> = {};
    canvasTokens.forEach(token => { adjacency[token.id] = []; });

    connections.forEach(({ from, to }) => {
      adjacency[from]?.push(to);
      adjacency[to]?.push(from);
    });

    const visited = new Set<string>();

    canvasTokens.forEach(token => {
      if (visited.has(token.id)) return;

      const component: CanvasToken[] = [];
      const queue = [token.id];
      visited.add(token.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentToken = canvasTokens.find(candidate => candidate.id === currentId);
        if (currentToken) component.push(currentToken);

        adjacency[currentId]?.forEach(nextId => {
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        });
      }

      const tokensWithDrawings = component.filter(item => item.drawingDataUrl);
      const visibleCount = component.length > 1 ? 3 : 1;
      tokensWithDrawings.slice(0, visibleCount).forEach(item => thumbnailIds.add(item.id));
    });

    return thumbnailIds;
  };

  // Soft proximity blobs: user-created spatial fields — no label, no lock
  // Returns blob data for connected components of 2+ tokens
  function calculateProximityBlobs() {
    const blobData: Array<{
      id: string;
      x: number;
      y: number;
      radius: number;
      isStable: boolean; // held together > 3s without interaction = stronger visual
    }> = [];

    const visited = new Set<string>();

    connections.forEach(conn => {
      if (visited.has(conn.from)) return;

      const cluster = new Set<string>([conn.from]);
      const toVisit = [conn.from];

      while (toVisit.length > 0) {
        const current = toVisit.pop()!;
        visited.add(current);
        connections.forEach(c => {
          if (c.from === current && !visited.has(c.to)) { cluster.add(c.to); toVisit.push(c.to); }
          if (c.to === current && !visited.has(c.from)) { cluster.add(c.from); toVisit.push(c.from); }
        });
      }

      if (cluster.size >= 2) {
        const clusterTokens = Array.from(cluster)
          .map(id => canvasTokens.find(t => t.id === id))
          .filter((t): t is CanvasToken => t !== undefined);

        if (clusterTokens.length > 0) {
          const avgX = clusterTokens.reduce((sum, t) => sum + t.x, 0) / clusterTokens.length;
          const avgY = clusterTokens.reduce((sum, t) => sum + t.y, 0) / clusterTokens.length;
          const maxDist = Math.max(...clusterTokens.map(t => getDistance(avgX, avgY, t.x, t.y)));
          const radius = Math.max(maxDist + 88, 100);
          const lastTouched = Math.max(...clusterTokens.map(t => t.lastInteracted || 0));
          const quietMs = currentTime - lastTouched;

          blobData.push({
            id: Array.from(cluster).sort().join(','),
            x: avgX,
            y: avgY,
            radius,
            isStable: quietMs > 3000, // stable = untouched for 3s
          });
        }
      }
    });

    return blobData;
  }

  // Sync database tokens to canvas tokens
  useEffect(() => {
    console.log('[TokenClusteringCanvas] dbTokens updated, count:', dbTokens.length);

    const newCanvasTokens = dbTokens.map(dbToken => {
      const existing = canvasTokens.find(ct => ct.id === dbToken.id);
      const defaultY = Math.max(TOP_RESTRICTED_AREA + 50, 200 + Math.random() * 300);
      return {
        id: dbToken.id,
        x: existing?.x ?? (dbToken.position.x || (300 + Math.random() * 400)),
        y: existing?.y ?? (dbToken.position.y ? Math.max(dbToken.position.y, TOP_RESTRICTED_AREA + 50) : defaultY),
        label: dbToken.text,
        description: dbToken.description || '',
        drawingDataUrl: dbToken.drawingDataUrl || null,
        rotation: existing?.rotation ?? dbToken.rotation ?? 0,
        scale: existing?.scale ?? dbToken.scale ?? 1,
        lastInteracted: existing?.lastInteracted ?? Date.now(),
        status: dbToken.status || "active",
        ai_metadata: dbToken.ai_metadata || null,
      };
    });

    setCanvasTokens(newCanvasTokens);
    canvasTokensRef.current = newCanvasTokens; // Update ref
    setTokenCounter(dbTokens.length);

    // Clean selection if selected token was deleted
    if (selectedTokenId && !newCanvasTokens.some(t => t.id === selectedTokenId)) {
      setSelectedTokenId(null);
    }

    if (dbTokens.length === 0) {
      console.log('[TokenClusteringCanvas] Canvas cleared');
    }
  }, [dbTokens, selectedTokenId]);

  // Seed demo ideas automatically for "demo" session ID
  useEffect(() => {
    if (!loading && dbTokens.length === 0 && sessionId.startsWith('demo')) {
      console.log('[TokenClusteringCanvas] Seeding demo ideas...');
      const demoIdeas = [
        { text: 'Robotica & AI Systemen', desc: 'Robots en AI technologie inzetten voor het team.', x: 350, y: 300 },
        { text: 'Co-creatie Hubs', desc: 'Fysieke ruimte waar burgers en ontwerpers samen prototypes testen.', x: 450, y: 380 },
        { text: 'AI Ethiek & Systeem', desc: 'Transparante controle op data, privacy en AI systemen.', x: 550, y: 280 }
      ];
      // Seed tokens with a slight staggered delay to make spawn animations play beautifully
      demoIdeas.forEach((idea, index) => {
        setTimeout(() => {
          addToken(idea.text, { x: idea.x, y: idea.y }, idea.desc);
        }, index * 250);
      });
    }
  }, [loading, dbTokens.length, sessionId, addToken]);

  // Suggested relations tracking & scoring
  useEffect(() => {
    const activeList: Array<{ id: string; sourceId: string; targetId: string; score: number }> = [];

    // Pairwise comparison of all canvas tokens
    for (let i = 0; i < clusterableCanvasTokens.length; i++) {
      for (let j = i + 1; j < clusterableCanvasTokens.length; j++) {
        const t1 = clusterableCanvasTokens[i];
        const t2 = clusterableCanvasTokens[j];

        const d = getDistance(t1.x, t1.y, t2.x, t2.y);
        // Suggested lines disappear if they get snapped (d < SNAP_DISTANCE) or if they are dragged too far (d > 380)
        if (d < SNAP_DISTANCE || d > 380) continue;

        const score = calculateSemanticScore(t1.label, t1.description, t2.label, t2.description);
        if (score > 0.75) {
          activeList.push({
            id: [t1.id, t2.id].sort().join('-'),
            sourceId: t1.id,
            targetId: t2.id,
            score
          });
        }
      }
    }

    // Sort by score descending and take top 3 suggestions
    const top3 = activeList.sort((a, b) => b.score - a.score).slice(0, 3);
    const top3Ids = new Set(top3.map(s => s.id));

    if (activeRelation) {
      const stillValid = top3.some(s => 
        (s.sourceId === activeRelation.sourceId && s.targetId === activeRelation.targetId) ||
        (s.sourceId === activeRelation.targetId && s.targetId === activeRelation.sourceId)
      );
      if (!stillValid) {
        setActiveRelation(null);
      }
    }

    setSuggestionLines(prev => {
      const updated = [...prev];
      let changed = false;

      // Update existing entries and mark leaving entries
      updated.forEach(line => {
        if (top3Ids.has(line.id)) {
          const match = top3.find(s => s.id === line.id)!;
          if (line.score !== match.score || line.isLeaving) {
            line.score = match.score;
            line.isLeaving = false;
            changed = true;
          }
        } else {
          if (!line.isLeaving) {
            line.isLeaving = true;
            changed = true;
          }
        }
      });

      // Add new entries
      top3.forEach(line => {
        if (!updated.some(l => l.id === line.id)) {
          changed = true;
          updated.push({
            id: line.id,
            sourceId: line.sourceId,
            targetId: line.targetId,
            score: line.score,
            currentOpacity: 0, // start from 0 to fade-in
            isLeaving: false
          });
        }
      });

      return changed ? updated : prev;
    });
  }, [canvasTokens, activeRelation]);

  // Animating tick loop for smooth opacity transitions
  useEffect(() => {
    let animId: number;

    const tick = () => {
      setSuggestionLines(prev => {
        let changed = false;
        const next = prev.map(line => {
          const target = line.isLeaving ? 0 : 1;
          const diff = target - line.currentOpacity;

          if (Math.abs(diff) > 0.01) {
            changed = true;
            return {
              ...line,
              currentOpacity: line.currentOpacity + diff * 0.12
            };
          }
          return line;
        }).filter(line => !(line.isLeaving && line.currentOpacity < 0.05));

        if (next.length !== prev.length) changed = true;
        return changed ? next : prev;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Track mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
      return () => canvas.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  // Update time for checking wilted status & inactivity timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);



  const proximityBlobs = calculateProximityBlobs();

  const isInArchiveZone = (x: number, y: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return false;

    return (
      x <= EDGE_ARCHIVE_DISTANCE ||
      y <= EDGE_ARCHIVE_DISTANCE ||
      x >= rect.width - EDGE_ARCHIVE_DISTANCE ||
      y >= rect.height - EDGE_ARCHIVE_DISTANCE
    );
  };

  const flushTokenPersist = (id: string) => {
    const pending = pendingTokenPersistRef.current[id];
    if (!pending) return;

    const timer = persistTimersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete persistTimersRef.current[id];
    }
    delete pendingTokenPersistRef.current[id];

    if (pending.position) {
      updateTokenPosition(id, pending.position);
    }
    if (typeof pending.rotation === 'number') {
      updateTokenRotation(id, pending.rotation);
    }
    if (typeof pending.scale === 'number') {
      updateTokenScale(id, pending.scale);
    }
  };

  const scheduleTokenPersist = (
    id: string,
    patch: {
      position?: { x: number; y: number };
      rotation?: number;
      scale?: number;
    }
  ) => {
    pendingTokenPersistRef.current[id] = {
      ...pendingTokenPersistRef.current[id],
      ...patch,
    };

    if (persistTimersRef.current[id]) return;
    persistTimersRef.current[id] = setTimeout(() => flushTokenPersist(id), 100);
  };

  useEffect(() => {
    return () => {
      Object.values(persistTimersRef.current).forEach(clearTimeout);
      Object.keys(pendingTokenPersistRef.current).forEach(flushTokenPersist);
    };
  }, []);

  const handleMove = (id: string, newX: number, newY: number) => {
    setSelectedRelationKey(null);
    const constrainedY = Math.max(newY, TOP_RESTRICTED_AREA + 50);
    setArchiveCandidateId(isInArchiveZone(newX, constrainedY) ? id : null);

    setCanvasTokens(prev => {
      const updated = prev.map(token =>
        token.id === id ? { ...token, x: newX, y: constrainedY, lastInteracted: Date.now() } : token
      );
      canvasTokensRef.current = updated;
      return updated;
    });

    scheduleTokenPersist(id, { position: { x: newX, y: constrainedY } });
  };

  const handleRotate = (id: string, rotation: number) => {
    setSelectedRelationKey(null);

    setCanvasTokens(prev => {
      const updated = prev.map(token =>
        token.id === id ? { ...token, rotation, lastInteracted: Date.now() } : token
      );
      canvasTokensRef.current = updated;
      return updated;
    });

    scheduleTokenPersist(id, { rotation });
  };

  const handleScale = (id: string, scale: number) => {
    setSelectedRelationKey(null);

    setCanvasTokens(prev => {
      const updated = prev.map(token =>
        token.id === id ? { ...token, scale, lastInteracted: Date.now() } : token
      );
      canvasTokensRef.current = updated;
      return updated;
    });

    scheduleTokenPersist(id, { scale });
  };





  const handleTokenRelease = async (id: string, x: number, y: number) => {
    flushTokenPersist(id);
    const shouldArchive = isInArchiveZone(x, y);
    setArchiveCandidateId(null);

    if (!shouldArchive) return;

    const token = canvasTokens.find(t => t.id === id);
    const tokenLabel = token ? `"${token.label}"` : 'dit idee';

    if (window.confirm(`Weet je zeker dat je ${tokenLabel} wilt parkeren?`)) {
      setSelectedTokenId(null);
      setSelectedRelationKey(null);
      setArchiveFeedback("Token geparkeerd");
      await archiveToken(id);
      setTimeout(() => setArchiveFeedback(null), 2200);
    } else {
      // Bounce back to active canvas area
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        let bounceX = x;
        let bounceY = y;
        const bounceOffset = EDGE_ARCHIVE_DISTANCE + 40;

        if (x <= EDGE_ARCHIVE_DISTANCE) bounceX = bounceOffset;
        else if (x >= rect.width - EDGE_ARCHIVE_DISTANCE) bounceX = rect.width - bounceOffset;

        if (y <= EDGE_ARCHIVE_DISTANCE) bounceY = bounceOffset;
        else if (y >= rect.height - EDGE_ARCHIVE_DISTANCE) bounceY = rect.height - bounceOffset;

        // Ensure within canvas bounds
        const constrainedY = Math.max(TOP_RESTRICTED_AREA + 50, Math.min(bounceY, rect.height - 40));

        // Update local state
        setCanvasTokens(prev => {
          const updated = prev.map(t =>
            t.id === id ? { ...t, x: bounceX, y: constrainedY, lastInteracted: Date.now() } : t
          );
          canvasTokensRef.current = updated;
          return updated;
        });

        // Update database
        updateTokenPosition(id, { x: bounceX, y: constrainedY });
      }
    }
  };

  const handleCanvasClick = (e: ReactMouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedTokenId(null);
      setSelectedRelationKey(null);
      setActiveRelation(null);
    }
  };

  // Unique relation key generator (sorted pair IDs)
  const getRelationKey = (id1: string, id2: string) => {
    return [id1, id2].sort().join('-');
  };

  // Determine Dutch dynamic contextual hint (Connection Preview State)
  const getHelpHint = () => {
    if (archiveCandidateId) {
      return "Laat los om uit actieve ruimte te halen.";
    }
    if (proximityLines.length > 0 && !selectedTokenId && !selectedRelationKey) {
      return "Misschien zit hier een verband.";
    }
    if (canvasTokens.length > 0 && connections.length === 0 && !selectedTokenId) {
      return "Sleep ideeën naar elkaar toe om verbanden te ontdekken.";
    }
    return "";
  };

  const currentHint = getHelpHint();
  const drawingThumbnailIds = getDrawingThumbnailIds();
  const showStartState = !loading && canvasTokens.length === 0;

  // Dimming evaluation
  const isAnyFocus = !!selectedTokenId || !!selectedRelationKey;

  const isTokenDimmed = (tokenId: string) => {
    if (selectedTokenId) {
      return selectedTokenId !== tokenId;
    }
    if (selectedRelationKey) {
      const [idA, idB] = selectedRelationKey.split('-');
      return idA !== tokenId && idB !== tokenId;
    }
    return false;
  };

  const isLineActive = (fromId: string, toId: string) => {
    if (selectedRelationKey) {
      return getRelationKey(fromId, toId) === selectedRelationKey;
    }
    if (selectedTokenId) {
      return selectedTokenId === fromId || selectedTokenId === toId;
    }
    return true; // No active focus: draw normally (subtly)
  };



  // Disable all browser default gestures on the table canvas
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const prevent = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    el.addEventListener('touchmove',  prevent, { passive: false });
    el.addEventListener('wheel',       prevent, { passive: false });
    el.addEventListener('contextmenu', prevent);
    return () => {
      el.removeEventListener('touchstart', prevent);
      el.removeEventListener('touchmove',  prevent);
      el.removeEventListener('wheel',       prevent);
      el.removeEventListener('contextmenu', prevent);
    };
  }, []);

  return (
    <div
      ref={outerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ backgroundColor: '#f4f4f5', touchAction: 'none', userSelect: 'none' }}
    >

      {/* Spatial archive edge zone */}
      <div
        className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-150"
        style={{
          border: archiveCandidateId ? '8px solid #71717a' : '8px solid transparent',
          opacity: archiveCandidateId ? 0.45 : 0,
        }}
      />

      {archiveFeedback && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1200] bg-white border border-zinc-500 rounded px-4 py-2 text-xs font-bold text-zinc-950">
          {archiveFeedback}
        </div>
      )}

      {!loading && !backendConnected && (
        <div className="absolute top-4 left-4 z-50 bg-white border border-zinc-500 rounded px-3 py-1.5 text-xs font-bold text-zinc-950">
          Verbinding verbroken
        </div>
      )}

      {/* Base wireframe grid background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent 0px, transparent 40px, #000000 40px, #000000 41px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 40px, #000000 40px, #000000 41px)
        `,
        backgroundSize: '40px 40px',
      }}></div>

      {/* Subtle center marker (tiny crosshair) - permanently visible */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 opacity-10 flex items-center justify-center pointer-events-none select-none">
        <div className="absolute w-4 h-px bg-zinc-950" />
        <div className="absolute h-4 w-px bg-zinc-950" />
        <div className="w-1.5 h-1.5 rounded-full border border-zinc-950 bg-transparent" />
      </div>

      <div ref={canvasRef} className="w-full h-full relative" style={{ touchAction: 'none' }} onClick={handleCanvasClick}>
        {showStartState && (
          <TableEmptyState />
        )}


        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <filter id="subtle-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Dynamic Suggested Relations */}
          {suggestionLines.map((line) => {
            const token1 = canvasTokens.find((t) => t.id === line.sourceId);
            const token2 = canvasTokens.find((t) => t.id === line.targetId);
            if (!token1 || !token2) return null;

            const d = getDistance(token1.x, token1.y, token2.x, token2.y);
            // Linear fade out as tokens are pulled apart (between 140px and 380px)
            const distanceFade = Math.max(0, Math.min(1, 1 - (d - 140) / (380 - 140)));
            
            const isActive = activeRelation && (
              (activeRelation.sourceId === line.sourceId && activeRelation.targetId === line.targetId) ||
              (activeRelation.sourceId === line.targetId && activeRelation.targetId === line.sourceId)
            );

            const opacity = isActive ? 0.9 : (line.currentOpacity * distanceFade * line.score * 0.35);

            if (opacity < 0.01) return null;

            return (
              <g
                key={`suggested-${line.id}`}
                className="suggested-relation-group"
                style={{
                  opacity,
                  transition: 'opacity 0.2s ease-out',
                  pointerEvents: 'auto',
                }}
              >
                {/* Thick invisible click target */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  stroke="transparent"
                  strokeWidth="24"
                  className="cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveRelation({ sourceId: line.sourceId, targetId: line.targetId });
                  }}
                />
                {/* Visible suggested line */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  stroke={isActive ? "#34d399" : "#10b981"}
                  strokeWidth={isActive ? "2.2" : "1.5"}
                  strokeDasharray="4,3"
                  style={{
                    filter: 'url(#subtle-glow)',
                  }}
                />
              </g>
            );
          })}

          {/* Subtle proximity preview lines - hidden when any focus is active */}
          {!isAnyFocus && proximityLines.map(({ from, to }, index) => {
            const token1 = canvasTokens.find((t) => t.id === from);
            const token2 = canvasTokens.find((t) => t.id === to);
            if (!token1 || !token2) return null;
            return (
              <line
                key={`prox-${from}-${to}-${index}`}
                x1={token1.x}
                y1={token1.y}
                x2={token2.x}
                y2={token2.y}
                stroke="#a1a1aa"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                strokeLinecap="round"
              />
            );
          })}

          {/* Solid connections (Dimmable) */}
          {connections.map(({ from, to }, index) => {
            const token1 = canvasTokens.find((t) => t.id === from);
            const token2 = canvasTokens.find((t) => t.id === to);
            if (!token1 || !token2) return null;

            const isActive = isLineActive(from, to);
            const key = getRelationKey(from, to);
            const isSelected = selectedRelationKey === key;

            // Non-relevant lines are drawn at 0.03 opacity (dimmed)
            const opacity = isSelected ? 0.8 : isActive ? 0.25 : 0.03;
            const strokeWidth = isSelected ? 3 : 1.5;

            return (
              <g
                key={`solid-${from}-${to}-${index}`}
                className="relation-group"
                style={{
                  transition: 'opacity 0.3s ease-out',
                  pointerEvents: (isSelected || !isAnyFocus) ? 'auto' : 'none',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTokenId(null);
                  setSelectedRelationKey(key);
                  setAiPrompt(null);
                }}
              >
                {/* Thick invisible click target */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  stroke="transparent"
                  strokeWidth="24"
                  className="cursor-pointer"
                  style={{ pointerEvents: 'auto' }}
                />
                {/* Selection backing highlight */}
                {isSelected && (
                  <line
                    x1={token1.x}
                    y1={token1.y}
                    x2={token2.x}
                    y2={token2.y}
                    stroke="#e4e4e7"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                )}
                {/* Visible line */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  className="relation-line"
                  stroke={isSelected ? "#09090b" : "#71717a"}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  opacity={opacity}
                />
              </g>
            );
          })}

        </svg>

        {/* HTML Snap/Unsnap ripples */}
        {ripples.map((ripple) => {
          if (ripple.type === 'snap') {
            return (
              <div
                key={ripple.id}
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  left: `${ripple.x}px`,
                  top: `${ripple.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 6,
                }}
              >
                {/* Inner expanding ring */}
                <div
                  className="rounded-full border-zinc-950 border animate-html-ripple-snap"
                  style={{
                    position: 'absolute',
                  }}
                />
                {/* Outer expanding ring */}
                <div
                  className="rounded-full border-zinc-950 border animate-html-ripple-snap-outer"
                  style={{
                    position: 'absolute',
                  }}
                />
              </div>
            );
          } else {
            return (
              <div
                key={ripple.id}
                className="absolute pointer-events-none flex items-center justify-center"
                style={{
                  left: `${ripple.x}px`,
                  top: `${ripple.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 6,
                }}
              >
                {/* Collapsing dashed ring */}
                <div
                  className="rounded-full border-zinc-500 border-dashed animate-html-ripple-unsnap"
                  style={{
                    position: 'absolute',
                  }}
                />
              </div>
            );
          }
        })}

        {/* Soft proximity blobs — user-created spatial fields, no label, no lock */}
        {proximityBlobs.map((blob) => (
          <div
            key={`blob-${blob.id}`}
            className="absolute pointer-events-none proximity-blob"
            style={{
              left: `${blob.x}px`,
              top: `${blob.y}px`,
              width: `${blob.radius * 2}px`,
              height: `${blob.radius * 2}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: blob.isStable
                ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.045) 0%, rgba(0,0,0,0.018) 55%, transparent 100%)'
                : 'radial-gradient(ellipse at center, rgba(0,0,0,0.025) 0%, rgba(0,0,0,0.008) 55%, transparent 100%)',
              zIndex: 2,
            }}
          />
        ))}

        {/* Tokens */}
        {canvasTokens.map((token) => {
          return (
            <Token
              key={token.id}
              id={token.id}
              x={token.x}
              y={token.y}
              label={token.label}
              description={token.description}
              drawingDataUrl={token.drawingDataUrl}
              rotation={token.rotation}
              showDrawingThumbnail={drawingThumbnailIds.has(token.id)}
              isConnected={connectedTokenIds.has(token.id)}
              isPulsing={false}
              isYellowSuggested={false}
              allTokens={canvasTokens.map(t => ({ id: t.id, x: t.x, y: t.y }))}
              onMove={handleMove}
              onRotate={handleRotate}
              onRelease={handleTokenRelease}
              onScale={handleScale}
              scale={token.scale}
              isSelected={selectedTokenId === token.id}
              onSelect={(id) => {
                setSelectedTokenId(id);
                setSelectedRelationKey(null);
              }}
              isDimmed={isTokenDimmed(token.id)}
              status={token.status}
              ai_metadata={token.ai_metadata}
            />
          );
        })}






      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1.02);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .relation-group {
          cursor: pointer;
        }
        .relation-line {
          transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
        }
        .relation-group:hover .relation-line {
          stroke: #09090b;
          opacity: 0.6;
          stroke-width: 2.5px;
        }
        @keyframes htmlRippleSnap {
          0% {
            width: 20px;
            height: 20px;
            opacity: 1;
            border-width: 3px;
          }
          100% {
            width: 120px;
            height: 120px;
            opacity: 0;
            border-width: 0.5px;
          }
        }
        @keyframes htmlRippleSnapOuter {
          0% {
            width: 10px;
            height: 10px;
            opacity: 0.8;
            border-width: 1.5px;
          }
          100% {
            width: 80px;
            height: 80px;
            opacity: 0;
            border-width: 0.5px;
          }
        }
        @keyframes htmlRippleUnsnap {
          0% {
            width: 80px;
            height: 80px;
            opacity: 0.8;
            border-width: 2px;
          }
          100% {
            width: 20px;
            height: 20px;
            opacity: 0;
            border-width: 0.5px;
          }
        }
        .animate-html-ripple-snap {
          animation: htmlRippleSnap 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        .animate-html-ripple-snap-outer {
          animation: htmlRippleSnapOuter 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        .animate-html-ripple-unsnap {
          animation: htmlRippleUnsnap 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .token-container {
          transition-property: transform, opacity !important;
        }
        .animate-token-spawn {
          animation: tokenSpawn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          transform-origin: center;
        }
        @keyframes tokenSpawn {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          55% {
            opacity: 1;
            transform: scale(1.12);
          }
          75% {
            transform: scale(0.97);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-token-ripple-1 {
          animation: tokenRipple 1.0s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }
        .animate-token-ripple-2 {
          animation: tokenRipple 1.0s cubic-bezier(0.1, 0.8, 0.3, 1) 0.15s forwards;
        }
        @keyframes tokenRipple {
          0% {
            width: 40px;
            height: 40px;
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(0.8);
            border-width: 2px;
          }
          100% {
            width: 280px;
            height: 280px;
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.4);
            border-width: 0.5px;
          }
        }
        .proximity-blob {
          transition-property: left, top, width, height, opacity, background !important;
          transition-duration: 0.6s !important;
          transition-timing-function: cubic-bezier(0.25, 1, 0.5, 1) !important;
        }
        .suggested-relation-group {
          animation: suggestionPulse 2.5s infinite ease-in-out;
        }
        @keyframes suggestionPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </div>
  );
}
