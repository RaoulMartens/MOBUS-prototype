import { useState, useRef, useEffect } from 'react';
import { Token } from './Token';
import { useTokens } from '../contexts/TokenContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

interface CanvasToken {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  scale: number;
  lastInteracted: number;
}

const SNAP_DISTANCE = 140;
const TOP_RESTRICTED_AREA = 80; // Keep tokens below this Y coordinate

export function TokenClusteringCanvas() {
  const { tokens: dbTokens, addToken, updateTokenDescription, deleteToken, deleteAllTokens, loading, backendConnected } = useTokens();
  const [canvasTokens, setCanvasTokens] = useState<CanvasToken[]>([]);
  const [tokenCounter, setTokenCounter] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasTokensRef = useRef<CanvasToken[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [scaleMode, setScaleMode] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [cursorPulse, setCursorPulse] = useState<{ tokenId: string; suggestion: string } | null>(null);
  const [randomSuggestions, setRandomSuggestions] = useState<Set<string>>(new Set());
  const [yellowConnections, setYellowConnections] = useState<Array<{ from: string; to: string }>>([]);
  const [blueWave, setBlueWave] = useState<{ tokenId: string; suggestion: string; startTime: number } | null>(null);

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
        scale: existing?.scale ?? 1,
        lastInteracted: existing?.lastInteracted ?? Date.now(),
      };
    });
    setCanvasTokens(newCanvasTokens);
    canvasTokensRef.current = newCanvasTokens; // Update ref
    setTokenCounter(dbTokens.length);

    if (dbTokens.length === 0) {
      console.log('[TokenClusteringCanvas] Canvas cleared - all tokens removed');
    }
  }, [dbTokens]);

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

  // Yellow random clustering suggestions - every 8 seconds
  useEffect(() => {
    const triggerYellowConnections = () => {
      const currentTokens = canvasTokensRef.current;
      if (currentTokens.length >= 2) {
        const numConnections = Math.floor(Math.random() * 3) + 2; // 2-4 tokens
        const shuffled = [...currentTokens].sort(() => Math.random() - 0.5);
        const selectedTokens = shuffled.slice(0, Math.min(numConnections, currentTokens.length));

        const newConnections: Array<{ from: string; to: string }> = [];
        for (let i = 0; i < selectedTokens.length - 1; i++) {
          newConnections.push({
            from: selectedTokens[i].id,
            to: selectedTokens[i + 1].id
          });
        }

        setYellowConnections(newConnections);

        // Clear after 5 seconds (linger longer)
        setTimeout(() => {
          setYellowConnections([]);
        }, 5000);
      }
    };

    // Initial trigger after 3 seconds
    const initialTimeout = setTimeout(() => {
      triggerYellowConnections();
    }, 3000);

    // Then repeat every 8 seconds
    const interval = setInterval(() => {
      triggerYellowConnections();
    }, 8000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []); // Empty dependency array - only run once on mount

  // Blue wave suggestion - triggers periodically when mouse is on canvas
  useEffect(() => {
    const triggerBlueWave = () => {
      const currentTokens = canvasTokensRef.current;
      console.log('[Blue Wave] Trigger check:', {
        hasTokens: currentTokens.length > 0,
        hasMousePos: !!mousePos,
        hasExistingWave: !!blueWave,
        tokenCount: currentTokens.length
      });

      if (currentTokens.length > 0 && mousePos && !blueWave) {
        const randomToken = currentTokens[Math.floor(Math.random() * currentTokens.length)];
        const suggestions = [
          `Consider expanding on "${randomToken.label}"`,
          `How does "${randomToken.label}" connect to your goals?`,
          `What if you merged "${randomToken.label}" with another idea?`,
          `"${randomToken.label}" could be a key insight`,
          `Explore "${randomToken.label}" from a different angle`,
        ];
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
        console.log('[Blue Wave] Creating wave for token:', randomToken.label);
        setBlueWave({ tokenId: randomToken.id, suggestion: randomSuggestion, startTime: Date.now() });

        // Auto-clear the wave after 5 seconds (longer than the 4s animation)
        setTimeout(() => {
          console.log('[Blue Wave] Auto-clearing wave');
          setBlueWave(null);
        }, 5000);
      }
    };

    // Initial trigger after 3 seconds
    const initialTimeout = setTimeout(() => {
      console.log('[Blue Wave] Initial trigger after 3s');
      triggerBlueWave();
    }, 3000);

    // Trigger every 12 seconds if mouse is present and no wave is showing
    const interval = setInterval(() => {
      console.log('[Blue Wave] Interval tick');
      if (mousePos && !blueWave) {
        triggerBlueWave();
      }
    }, 12000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [mousePos, blueWave]);

  // Update time for wilting effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for scale mode
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 's' || e.key === 'S') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setScaleMode(prev => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading canvas...</div>
      </div>
    );
  }

  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };

  const handleMove = (id: string, newX: number, newY: number) => {
    setCursorPulse(null);
    setBlueWave(null);
    setYellowConnections([]);
    // Constrain Y position to keep tokens below the top restricted area
    const constrainedY = Math.max(newY, TOP_RESTRICTED_AREA + 50);
    setCanvasTokens(prev => prev.map(token =>
      token.id === id ? { ...token, x: newX, y: constrainedY, lastInteracted: Date.now() } : token
    ));
  };

  const getConnections = () => {
    const connections: Array<{ from: string; to: string }> = [];
    const connectedTokenIds = new Set<string>();

    canvasTokens.forEach((token, i) => {
      canvasTokens.slice(i + 1).forEach((otherToken) => {
        const distance = getDistance(token.x, token.y, otherToken.x, otherToken.y);
        if (distance < SNAP_DISTANCE) {
          connections.push({ from: token.id, to: otherToken.id });
          connectedTokenIds.add(token.id);
          connectedTokenIds.add(otherToken.id);
        }
      });
    });

    return { connections, connectedTokenIds };
  };

  const { connections, connectedTokenIds } = getConnections();

  const handleAddToken = async () => {
    setCursorPulse(null);
    setBlueWave(null);
    setYellowConnections([]);
    const label = `Idea ${String.fromCharCode(65 + tokenCounter)}`;
    await addToken(label, {
      x: 300 + Math.random() * 400,
      y: Math.max(TOP_RESTRICTED_AREA + 50, 200) + Math.random() * 300,
    });
  };

  const handleScaleChange = (id: string, scale: number) => {
    setCursorPulse(null);
    setBlueWave(null);
    setYellowConnections([]);
    setCanvasTokens(prev => prev.map(token =>
      token.id === id ? { ...token, scale, lastInteracted: Date.now() } : token
    ));
  };

  const calculateGrassAreas = () => {
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

      if (cluster.size > 0) {
        const clusterTokens = Array.from(cluster).map(id =>
          canvasTokens.find(t => t.id === id)
        ).filter(t => t !== undefined) as CanvasToken[];

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
    });

    return clusterData;
  };

  const grassAreas = calculateGrassAreas();

  const handleDescriptionChange = async (id: string, description: string) => {
    setCursorPulse(null);
    setBlueWave(null);
    setYellowConnections([]);
    setCanvasTokens(prev => prev.map(token =>
      token.id === id ? { ...token, description, lastInteracted: Date.now() } : token
    ));
    await updateTokenDescription(id, description);
  };

  const handleCanvasClick = () => {
    if (cursorPulse) {
      setCursorPulse(null);
    }
    if (blueWave) {
      setBlueWave(null);
    }
    if (yellowConnections.length > 0) {
      setYellowConnections([]);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ backgroundColor: '#0f3a24' }}>
      {/* Status indicator */}
      {backendConnected && (
        <div className="absolute top-4 left-4 z-50">
          <Badge variant="default" className="bg-emerald-900/80 backdrop-blur-sm border-emerald-700/50 text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Screen 2 - Live
          </Badge>
        </div>
      )}

      {/* Base sparse grass background */}
      <div className="absolute inset-0 opacity-15" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent 0px, transparent 24px, rgba(16, 64, 36, 0.1) 24px, rgba(16, 64, 36, 0.1) 48px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 24px, rgba(16, 64, 36, 0.1) 24px, rgba(16, 64, 36, 0.1) 48px),
          linear-gradient(0deg, #1e5a3a 0%, #1a4d2e 50%, #16452a 100%)
        `,
        backgroundSize: '48px 48px, 48px 48px, 100% 100%',
      }}></div>

      {/* Dynamic cluster circles */}
      {grassAreas.map((area, index) => {
        const intensity = Math.min(area.size / 5, 1);
        const baseRadius = 80;
        const radius = baseRadius + (area.size * 40); // Scales with number of tokens

        if (area.isWilted) {
          return (
            <div
              key={`wilt-${index}`}
              className="absolute pointer-events-none transition-all duration-1000"
              style={{
                left: `${area.x}px`,
                top: `${area.y}px`,
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: `3px solid rgba(178, 34, 34, ${0.6 * intensity})`,
                background: `radial-gradient(circle at center,
                  rgba(139, 69, 19, ${0.15 * intensity}) 0%,
                  rgba(160, 82, 45, ${0.1 * intensity}) 50%,
                  transparent 100%
                )`,
                boxShadow: `0 0 30px rgba(178, 34, 34, ${0.3 * intensity}), inset 0 0 40px rgba(139, 69, 19, ${0.2 * intensity})`,
                opacity: 0.8,
              }}
            />
          );
        }

        return (
          <div
            key={`cluster-${index}`}
            className="absolute pointer-events-none transition-all duration-1000 animate-pulse-slow"
            style={{
              left: `${area.x}px`,
              top: `${area.y}px`,
              width: `${radius * 2}px`,
              height: `${radius * 2}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              border: `4px solid rgba(34, 197, 94, ${0.7 + intensity * 0.3})`,
              background: `radial-gradient(circle at center,
                rgba(34, 197, 94, ${0.15 * intensity}) 0%,
                rgba(16, 185, 129, ${0.1 * intensity}) 50%,
                transparent 100%
              )`,
              boxShadow: `0 0 40px rgba(34, 197, 94, ${0.4 + intensity * 0.2}), inset 0 0 30px rgba(16, 185, 129, ${0.15 * intensity})`,
              opacity: 0.9,
            }}
          />
        );
      })}

      <div ref={canvasRef} className="w-full h-full relative" onClick={handleCanvasClick}>
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Yellow random clustering suggestions */}
          {yellowConnections.map(({ from, to }, index) => {
            const token1 = canvasTokens.find((t) => t.id === from);
            const token2 = canvasTokens.find((t) => t.id === to);
            if (!token1 || !token2) return null;
            return (
              <g key={`yellow-${from}-${to}-${index}`}>
                {/* Outer glow layer */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  stroke="rgba(250, 204, 21, 0.3)"
                  strokeWidth="8"
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="opacity"
                    values="0.2;0.6;0.2"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </line>
                {/* Main pulsing line */}
                <line
                  x1={token1.x}
                  y1={token1.y}
                  x2={token2.x}
                  y2={token2.y}
                  stroke="rgba(250, 204, 21, 0.9)"
                  strokeWidth="4"
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="12"
                    dur="0.8s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.5;1;0.5"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-width"
                    values="4;5;4"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </line>
                {/* Pulsing circle at start token */}
                <circle
                  cx={token1.x}
                  cy={token1.y}
                  r="8"
                  fill="rgba(250, 204, 21, 0.4)"
                  stroke="rgba(250, 204, 21, 0.9)"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="8;12;8"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.6"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Pulsing circle at end token */}
                <circle
                  cx={token2.x}
                  cy={token2.y}
                  r="8"
                  fill="rgba(250, 204, 21, 0.4)"
                  stroke="rgba(250, 204, 21, 0.9)"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="8;12;8"
                    dur="1.5s"
                    repeatCount="indefinite"
                    begin="0.3s"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.6"
                    dur="1.5s"
                    repeatCount="indefinite"
                    begin="0.3s"
                  />
                </circle>
              </g>
            );
          })}

          {/* Blue wave suggestion - water-like half circles */}
          {blueWave && mousePos && (() => {
            const token = canvasTokens.find(t => t.id === blueWave.tokenId);
            if (!token) return null;

            const radius = 25;

            return (
              <g key="blue-wave">
                {/* Traveling semi-circles (half circles) */}
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <g key={`traveling-${i}`}>
                    <path
                      d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius}`}
                      fill="none"
                      stroke="rgba(14, 165, 233, 0.9)"
                      strokeWidth="3"
                    >
                      <animateMotion
                        dur="4s"
                        repeatCount="indefinite"
                        begin={`${i * 0.7}s`}
                        rotate="auto"
                      >
                        <mpath href="#blue-wave-path" />
                      </animateMotion>
                      <animate
                        attributeName="opacity"
                        values="0;0.9;0.9;0"
                        keyTimes="0;0.15;0.75;1"
                        dur="4s"
                        repeatCount="indefinite"
                        begin={`${i * 0.7}s`}
                      />
                      <animateTransform
                        attributeName="transform"
                        type="scale"
                        values="0.3;1.5"
                        dur="4s"
                        repeatCount="indefinite"
                        begin={`${i * 0.7}s`}
                        additive="sum"
                      />
                    </path>
                  </g>
                ))}

                {/* Define the path from token to cursor */}
                <path
                  id="blue-wave-path"
                  d={`M ${token.x} ${token.y} L ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="none"
                />

                {/* Impact at cursor */}
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="15"
                  fill="rgba(6, 182, 212, 0.3)"
                  stroke="rgba(14, 165, 233, 0.8)"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="15;25;15"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0.3;0.6"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })()}

          {/* Cursor wave ripple (legacy) */}
          {cursorPulse && mousePos && (() => {
            const token = canvasTokens.find(t => t.id === cursorPulse.tokenId);
            if (!token) return null;

            return (
              <g key="cursor-wave">
                <path
                  id="wave-path"
                  d={`M ${token.x} ${token.y} L ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="none"
                />
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="15"
                  fill="rgba(103, 232, 249, 0.3)"
                  stroke="rgba(34, 211, 238, 0.8)"
                  strokeWidth="2"
                >
                  <animate
                    attributeName="r"
                    values="15;25;15"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })()}

          {/* Green proximity connections removed - replaced with cluster circles */}
        </svg>

        {/* Tokens */}
        {canvasTokens.map((token) => {
          // Check if this token is part of yellow suggestions
          const isYellowSuggested = yellowConnections.some(
            conn => conn.from === token.id || conn.to === token.id
          );

          return (
            <Token
              key={token.id}
              id={token.id}
              x={token.x}
              y={token.y}
              label={token.label}
              description={token.description}
              isConnected={connectedTokenIds.has(token.id)}
              isPulsing={randomSuggestions.has(token.id)}
              isYellowSuggested={isYellowSuggested}
              allTokens={canvasTokens.map(t => ({ id: t.id, x: t.x, y: t.y }))}
              onMove={handleMove}
              onDescriptionChange={handleDescriptionChange}
              onDelete={deleteToken}
              scale={token.scale}
              onScaleChange={scaleMode ? handleScaleChange : undefined}
            />
          );
        })}

        {/* Controls */}
        <div className="absolute top-4 right-4 flex gap-3 z-50">
          <Button
            onClick={() => {
              if (window.confirm(`Delete all ${canvasTokens.length} tokens? This cannot be undone.`)) {
                deleteAllTokens();
              }
            }}
            variant="outline"
            size="lg"
            className="bg-red-900/80 hover:bg-red-800 text-red-200 border-red-600/50 hover:border-red-500 shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95 transition-all duration-300"
            title="Clear all tokens"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All
          </Button>

          <Button
            onClick={() => {
              setCursorPulse(null);
              setBlueWave(null);
              setYellowConnections([]);
              setScaleMode(!scaleMode);
            }}
            variant={scaleMode ? "default" : "outline"}
            size="lg"
            className={`transition-all duration-300 shadow-lg hover:scale-105 active:scale-95 ${
              scaleMode
                ? 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 shadow-yellow-500/50'
                : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border-emerald-600/50'
            }`}
            title="Toggle scale mode (S)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            {scaleMode ? 'Scale ON' : 'Scale'}
          </Button>

          <Button
            onClick={handleAddToken}
            size="lg"
            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <span className="text-lg group-hover:rotate-90 transition-transform duration-300">+</span>
            Add Idea
          </Button>
        </div>

        {/* Yellow suggestion label */}
        {yellowConnections.length > 0 && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
            <Card className="bg-gradient-to-br from-yellow-900/90 to-amber-900/90 backdrop-blur-md border-yellow-500/50 shadow-2xl">
              <CardContent className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-300 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-yellow-100 text-sm font-bold">
                    💡 System Suggestion: Consider pairing these ideas together
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Blue wave suggestion tooltip */}
        {blueWave && mousePos && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: `${mousePos.x}px`,
              top: `${mousePos.y - 60}px`,
              transform: 'translateX(-50%)',
            }}
          >
            <Card className="bg-gradient-to-br from-cyan-900 to-sky-900 backdrop-blur-md border-cyan-500/50 shadow-2xl max-w-xs">
              <CardContent className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-cyan-100 text-sm font-medium leading-tight">
                    {blueWave.suggestion}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 z-50">
          <Card className="bg-emerald-900/60 backdrop-blur-sm border-emerald-700/50 shadow-lg">
            <CardContent className="py-2 px-4">
              <p className="text-emerald-200 text-sm">
                <span className="text-emerald-400 font-semibold">Drag</span> to move •
                {scaleMode && <><span className="text-yellow-400 font-semibold">Scroll</span> on token to resize •</>}
                <span className="text-emerald-400 font-semibold">Connect</span> by proximity •
                <span className="text-yellow-400 font-semibold">Yellow</span> random suggestions •
                <span className="text-cyan-400 font-semibold">Blue waves</span> to explore
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.03);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
