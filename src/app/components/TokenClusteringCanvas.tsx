import { useState, useRef, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { Token } from './Token';
import { useTokens } from '../contexts/TokenContext';
import { Card, CardContent } from './ui/card';
import { Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Network IPs injected by Vite at build time
declare const __NETWORK_IPS__: string[];
const networkIPs: string[] = typeof __NETWORK_IPS__ !== 'undefined' ? __NETWORK_IPS__ : [];

/** Build a phone URL that works from another device on the same network */
const getNetworkPhoneUrl = (sessionId: string): string => {
  const { hostname, port, protocol } = window.location;
  // If already on a network IP, use it directly
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}${port ? ':' + port : ''}/phone?sessionId=${sessionId}`;
  }
  // Otherwise, use the first detected network IP
  if (networkIPs.length > 0) {
    return `${protocol}//${networkIPs[0]}${port ? ':' + port : ''}/phone?sessionId=${sessionId}`;
  }
  // Fallback
  return `${window.location.origin}/phone?sessionId=${sessionId}`;
};

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

export function TokenClusteringCanvas() {
  const {
    tokens: dbTokens,
    updateTokenPosition,
    updateTokenRotation,
    updateTokenScale,
    archiveToken,
    loading,
    backendConnected,
    sessionId
  } = useTokens();

  const [canvasTokens, setCanvasTokens] = useState<CanvasToken[]>([]);
  const [tokenCounter, setTokenCounter] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasTokensRef = useRef<CanvasToken[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Progressive Disclosure states
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedRelationKey, setSelectedRelationKey] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<AIPrompt | null>(null);

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
  const prevConnectionsRef = useRef<string[]>([]);
  const isFirstRender = useRef(true);
  const [archiveCandidateId, setArchiveCandidateId] = useState<string | null>(null);
  const [archiveFeedback, setArchiveFeedback] = useState<string | null>(null);

  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };

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

  function calculateGrassAreas() {
    const WILT_TIME = 30000;
    const clusterData: Array<{
      x: number;
      y: number;
      size: number;
      lastInteracted: number;
      isWilted: boolean;
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
          if (c.from === current && !visited.has(c.to)) {
            cluster.add(c.to);
            toVisit.push(c.to);
          }
          if (c.to === current && !visited.has(c.from)) {
            cluster.add(c.from);
            toVisit.push(c.from);
          }
        });
      }

      // ONLY size >= 3 forms clusters
      if (cluster.size >= 3) {
        const clusterTokens = Array.from(cluster).map(id =>
          canvasTokens.find(t => t.id === id)
        ).filter(t => t !== undefined) as CanvasToken[];

        if (clusterTokens.length > 0) {
          const avgX = clusterTokens.reduce((sum, t) => sum + t.x, 0) / clusterTokens.length;
          const avgY = clusterTokens.reduce((sum, t) => sum + t.y, 0) / clusterTokens.length;
          const lastInteracted = Math.max(...clusterTokens.map(t => t.lastInteracted || 0));
          const timeSinceInteraction = currentTime - lastInteracted;

          clusterData.push({
            x: avgX,
            y: avgY,
            size: clusterTokens.length,
            lastInteracted,
            isWilted: timeSinceInteraction > WILT_TIME
          });
        }
      }
    });

    return clusterData;
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
        rotation: dbToken.rotation ?? existing?.rotation ?? 0,
        scale: existing?.scale ?? 1,
        lastInteracted: existing?.lastInteracted ?? Date.now(),
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



  // Self-centering tabletop force: centers idea groups when quiet
  useEffect(() => {
    if (canvasTokens.length === 0) return;

    const interval = setInterval(() => {
      const lastInteractedMax = Math.max(...canvasTokensRef.current.map(t => t.lastInteracted || 0));
      const isQuiet = Date.now() - lastInteractedMax > 4000; // 4 seconds quiet time

      if (isQuiet && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const avgX = canvasTokensRef.current.reduce((sum, t) => sum + t.x, 0) / canvasTokensRef.current.length;
        const avgY = canvasTokensRef.current.reduce((sum, t) => sum + t.y, 0) / canvasTokensRef.current.length;

        const dx = centerX - avgX;
        const dy = centerY - avgY;

        // If off-center by more than 60px, shift slightly (smooth organic centering)
        if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
          setCanvasTokens(prev => {
            const updated = prev.map(token => {
              const newX = token.x + dx * 0.15;
              const constrainedY = Math.max(token.y + dy * 0.15, TOP_RESTRICTED_AREA + 50);

              // Sync position to Firestore in the background
              updateTokenPosition(token.id, { x: newX, y: constrainedY });

              return {
                ...token,
                x: newX,
                y: constrainedY,
                lastInteracted: Date.now()
              };
            });
            canvasTokensRef.current = updated;
            return updated;
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [canvasTokens.length, updateTokenPosition]);

  // AI Prompt collapsing timer: collapses full prompts after 5 seconds
  useEffect(() => {
    if (!aiPrompt || aiPrompt.isCollapsed) return;
    const timer = setTimeout(() => {
      setAiPrompt(prev => prev ? { ...prev, isCollapsed: true } : null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [aiPrompt?.text, aiPrompt?.isCollapsed]);

  // Cluster AI prompt trigger: triggers a creative prompt when a cluster forms
  const activeClusterCount = useRef(0);
  const grassAreas = calculateGrassAreas();

  useEffect(() => {
    const activeClusters = calculateGrassAreas();

    // Trigger only if a new cluster zone was created
    if (activeClusters.length > activeClusterCount.current && !aiPrompt) {
      const cluster = activeClusters[0];
      const clusterPrompts = [
        "Welk idee in dit cluster botst stiekem het hardst met de rest?",
        "Als deze groep ideeën een antwoord is, wat was dan de oorspronkelijke vraag?",
        "Wat ontbreekt er nog om van deze groep een concreet concept te maken?",
        "Wat gebeurt er als je de belangrijkste aanname van deze groep omdraait?"
      ];
      const promptText = "Misschien zit hier een verband.";

      setAiPrompt({
        text: promptText,
        x: cluster.x,
        y: cluster.y - 80,
        isCollapsed: false,
        targetId: `cluster-${cluster.x}-${cluster.y}`,
        createdAt: Date.now()
      });
    }
    activeClusterCount.current = activeClusters.length;
  }, [grassAreas.length, aiPrompt]);

  useEffect(() => {
    if (!connectionSignature || aiPrompt || selectedTokenId || selectedRelationKey) return;

    const timer = setTimeout(() => {
      const relation = connections[0];
      if (!relation) return;

      const tokenA = canvasTokens.find(token => token.id === relation.from);
      const tokenB = canvasTokens.find(token => token.id === relation.to);
      if (!tokenA || !tokenB) return;

      setAiPrompt({
        text: "Misschien zit hier een verband.",
        x: (tokenA.x + tokenB.x) / 2,
        y: (tokenA.y + tokenB.y) / 2 - 40,
        isCollapsed: false,
        targetId: `relation-${relation.from}-${relation.to}`,
        createdAt: Date.now()
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [connectionSignature, aiPrompt, selectedTokenId, selectedRelationKey, canvasTokens, connections]);

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

  const handleMove = (id: string, newX: number, newY: number) => {
    setAiPrompt(null); // Clear active prompts on move
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

    updateTokenPosition(id, { x: newX, y: constrainedY });
  };

  const handleRotate = (id: string, rotation: number) => {
    setAiPrompt(null);
    setSelectedRelationKey(null);

    setCanvasTokens(prev => {
      const updated = prev.map(token =>
        token.id === id ? { ...token, rotation, lastInteracted: Date.now() } : token
      );
      canvasTokensRef.current = updated;
      return updated;
    });

    updateTokenRotation(id, rotation);
  };

  const handleScale = (id: string, scale: number) => {
    setAiPrompt(null);
    setSelectedRelationKey(null);

    setCanvasTokens(prev => {
      const updated = prev.map(token =>
        token.id === id ? { ...token, scale, lastInteracted: Date.now() } : token
      );
      canvasTokensRef.current = updated;
      return updated;
    });

    updateTokenScale(id, scale);
  };





  const handleTokenRelease = async (id: string, x: number, y: number) => {
    const shouldArchive = isInArchiveZone(x, y);
    setArchiveCandidateId(null);

    if (!shouldArchive) return;

    const token = canvasTokens.find(t => t.id === id);
    const tokenLabel = token ? `"${token.label}"` : 'dit idee';

    if (window.confirm(`Weet je zeker dat je ${tokenLabel} wilt parkeren?`)) {
      setSelectedTokenId(null);
      setSelectedRelationKey(null);
      setAiPrompt(null);
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
    }
  };

  // Unique relation key generator (sorted pair IDs)
  const getRelationKey = (id1: string, id2: string) => {
    return [id1, id2].sort().join('-');
  };

  // Determine Dutch dynamic contextual hint (Connection Preview State)
  const getHelpHint = () => {
    if (aiPrompt) {
      return "MOBUS ziet een mogelijke denkrichting.";
    }
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
  const sessionCode = sessionId.replace(/^mobus-/, '');
  const phoneUrl = getNetworkPhoneUrl(sessionId);
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

  // Cluster circle visibility rule: only draw when cluster is targeted by AI prompt
  const shouldRenderClusterCircle = (area: any) => {
    if (aiPrompt && aiPrompt.targetId === `cluster-${area.x}-${area.y}`) return true;
    return false;
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: '#f4f4f5' }}>

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

      {/* Dynamic cluster circles (only when cluster has clear active purpose) */}
      {grassAreas.filter(shouldRenderClusterCircle).map((area, index) => {
        const baseRadius = 90;
        const radius = baseRadius + (area.size * 35);

        return (
          <div
            key={`cluster-${index}`}
            className="absolute pointer-events-none transition-all duration-1000"
            style={{
              left: `${area.x}px`,
              top: `${area.y}px`,
              width: `${radius * 2}px`,
              height: `${radius * 2}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: '1.5px dashed #71717a',
              background: 'transparent',
              boxShadow: 'none',
              opacity: 0.8,
            }}
          />
        );
      })}

      <div ref={canvasRef} className="w-full h-full relative" onClick={handleCanvasClick}>
        {showStartState && (
          <div className="absolute inset-0 z-20 flex items-center justify-center px-6 pointer-events-none">
            <div className="max-w-xl text-center pointer-events-auto">

              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-950 mb-4">
                Sessie gestart
              </h1>
              <p className="text-base md:text-lg text-zinc-600 mb-8">
                Verbind je telefoon om je eerste idee toe te voegen.
              </p>

              <div className="inline-flex flex-col md:flex-row items-center gap-8 bg-white px-10 py-8 rounded shadow-sm mb-7">
                {/* QR Code */}
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-lg border border-zinc-200">
                    <QRCodeSVG
                      value={phoneUrl}
                      size={160}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#09090b"
                    />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Scan met je telefoon
                  </span>
                  <a
                    href={`/phone?sessionId=${sessionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-zinc-950 underline hover:text-zinc-700 transition-colors"
                  >
                    Open op deze computer
                  </a>
                </div>

                {/* Divider */}
                <div className="hidden md:block w-px h-40 bg-zinc-200" />
                <div className="block md:hidden h-px w-40 bg-zinc-200" />

                {/* Session code */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Sessiecode
                  </span>
                  <span className="text-6xl font-black font-mono tracking-widest text-zinc-950">
                    {sessionCode}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
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

        {/* Midpoint interactive relation nodes and detail cards */}
        {connections.map(({ from, to }) => {
          const token1 = canvasTokens.find((t) => t.id === from);
          const token2 = canvasTokens.find((t) => t.id === to);
          if (!token1 || !token2) return null;

          const midX = (token1.x + token2.x) / 2;
          const midY = (token1.y + token2.y) / 2;
          const key = getRelationKey(from, to);
          const isSelected = selectedRelationKey === key;

          if (isSelected) {
            return (
              <div
                key={`relation-card-${key}`}
                className="absolute bg-white border border-zinc-950 rounded px-4 py-3 shadow-none z-50 animate-fade-in w-60 text-center"
                style={{
                  left: `${midX}px`,
                  top: `${midY}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1">Verband</p>
                <p className="text-xs text-zinc-950 leading-normal font-medium mb-2">
                  {generateRelationLabel(token1.label, token2.label)}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRelationKey(null);
                  }}
                  className="text-[9px] text-zinc-950 hover:underline font-bold uppercase tracking-wider mt-1 cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            );
          }

          return null;
        })}

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
              isYellowSuggested={aiPrompt?.targetId === token.id}
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
                setAiPrompt(null);
              }}
              isDimmed={isTokenDimmed(token.id)}
            />
          );
        })}

        {/* Dynamic Contextual Help Hint */}
        {currentHint && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
            <div className="bg-white border border-zinc-950 px-5 py-2 rounded flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-zinc-950 rounded-full" />
              <p className="text-zinc-950 text-xs font-semibold tracking-wide">
                {currentHint}
              </p>
            </div>
          </div>
        )}

        {/* Collapsing AI suggestions (Only 1 visible, amber/gold themed) */}
        {aiPrompt && (() => {
          if (aiPrompt.isCollapsed) {
            // Collapsed Marker (Pulse gold sparkle dot)
            return (
              <div
                className="absolute z-[950] cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 animate-fade-in"
                style={{
                  left: `${aiPrompt.x}px`,
                  top: `${aiPrompt.y + 15}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setAiPrompt(prev => prev ? { ...prev, isCollapsed: false } : null);
                }}
                title="Toon AI Suggestie"
              >
                <div className="w-6 h-6 bg-white border border-zinc-950 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-zinc-950" />
                </div>
              </div>
            );
          }

          // Full Expanded AI Prompt Card
          return (
            <div
              className="absolute z-[950] animate-fade-in"
              style={{
                left: `${aiPrompt.x}px`,
                top: `${aiPrompt.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="bg-white border border-zinc-950 rounded w-60 overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-zinc-950 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <p className="text-zinc-950 text-xs font-semibold leading-normal">
                        {aiPrompt.text}
                      </p>
                      <button
                        onClick={() => setAiPrompt(prev => prev ? { ...prev, isCollapsed: true } : null)}
                        className="text-[9px] text-zinc-500 hover:underline font-bold uppercase tracking-wider self-end mt-1 cursor-pointer"
                      >
                        Inklappen
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}


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
      `}</style>
    </div>
  );
}
