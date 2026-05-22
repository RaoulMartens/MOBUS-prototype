import { useState, useRef, useEffect } from 'react';
import { Token } from './Token';

interface TokenData {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  connectedTo: string[];
  scale?: number;
  lastInteracted?: number;
}

const SNAP_DISTANCE = 140;
const PULSE_INTERVAL = 5000;

const initialTokens: TokenData[] = [
  { id: '1', x: 200, y: 200, label: 'Idea A', description: '', connectedTo: [], scale: 1, lastInteracted: Date.now() },
  { id: '2', x: 400, y: 200, label: 'Idea B', description: '', connectedTo: [], scale: 1, lastInteracted: Date.now() },
  { id: '3', x: 600, y: 200, label: 'Idea C', description: '', connectedTo: [], scale: 1, lastInteracted: Date.now() },
  { id: '4', x: 300, y: 350, label: 'Idea D', description: '', connectedTo: [], scale: 1, lastInteracted: Date.now() },
  { id: '5', x: 500, y: 350, label: 'Idea E', description: '', connectedTo: [], scale: 1, lastInteracted: Date.now() },
];

interface TokenCanvasProps {
  tokens: TokenData[];
  onTokensChange: (tokens: TokenData[]) => void;
  randomSuggestions: Set<string>;
}

export function TokenCanvas({ tokens, onTokensChange, randomSuggestions }: TokenCanvasProps) {
  const [tokenCounter, setTokenCounter] = useState(tokens?.length || 0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [scaleMode, setScaleMode] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [cursorPulse, setCursorPulse] = useState<{ tokenId: string; suggestion: string } | null>(null);

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

  // Periodic cursor pulse from random token
  useEffect(() => {
    const interval = setInterval(() => {
      if (tokens.length > 0 && mousePos && !cursorPulse) {
        const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
        const suggestions = [
          `Consider expanding on "${randomToken.label}"`,
          `How does "${randomToken.label}" connect to your goals?`,
          `What if you merged "${randomToken.label}" with another idea?`,
          `"${randomToken.label}" could be a key insight`,
          `Explore "${randomToken.label}" from a different angle`,
          `"${randomToken.label}" might unlock new connections`,
        ];
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

        setCursorPulse({ tokenId: randomToken.id, suggestion: randomSuggestion });
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [tokens, mousePos, cursorPulse]);

  // Update time periodically to refresh wilting effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for scale mode (S key)
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

  if (!tokens) {
    return null;
  }


  const getDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };

  const handleMove = (id: string, newX: number, newY: number) => {
    if (!tokens) return;
    setCursorPulse(null); // Clear pulse on interaction
    const updatedTokens = tokens.map((token) => {
      if (token.id === id) {
        return { ...token, x: newX, y: newY, lastInteracted: Date.now() };
      }
      return token;
    });
    onTokensChange(updatedTokens);
  };

  // Calculate connections based on proximity
  const getConnections = () => {
    const connections: Array<{ from: string; to: string }> = [];
    const connectedTokenIds = new Set<string>();

    if (!tokens || !Array.isArray(tokens)) {
      return { connections, connectedTokenIds };
    }

    tokens.forEach((token, i) => {
      tokens.slice(i + 1).forEach((otherToken) => {
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

  const addToken = () => {
    setCursorPulse(null); // Clear pulse on interaction
    const newId = (tokenCounter + 1).toString();
    const newToken: TokenData = {
      id: newId,
      x: 300 + Math.random() * 400,
      y: 200 + Math.random() * 300,
      label: `Idea ${String.fromCharCode(65 + tokenCounter)}`,
      description: '',
      connectedTo: [],
      scale: 1,
      lastInteracted: Date.now(),
    };
    onTokensChange([...tokens, newToken]);
    setTokenCounter(tokenCounter + 1);
  };

  const handleScaleChange = (id: string, scale: number) => {
    if (!tokens) return;
    setCursorPulse(null); // Clear pulse on interaction
    const updatedTokens = tokens.map(token =>
      token.id === id ? { ...token, scale, lastInteracted: Date.now() } : token
    );
    onTokensChange(updatedTokens);
  };

  // Calculate grass intensity based on clusters
  const calculateGrassAreas = () => {
    const WILT_TIME = 30000; // 30 seconds of inactivity causes wilting
    const CLUSTER_RADIUS = 200;

    // Find all clusters with their metadata
    const clusterData: Array<{
      x: number;
      y: number;
      size: number;
      lastInteracted: number;
      isWilted: boolean;
    }> = [];

    // Group connected tokens into clusters
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
          tokens.find(t => t.id === id)
        ).filter(t => t !== undefined);

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

  const updateTokenDescription = (id: string, description: string) => {
    if (!tokens) return;
    setCursorPulse(null); // Clear pulse on interaction
    const updatedTokens = tokens.map(token =>
      token.id === id ? { ...token, description, lastInteracted: Date.now() } : token
    );
    onTokensChange(updatedTokens);
  };

  const handleCanvasClick = () => {
    if (cursorPulse) {
      setCursorPulse(null); // Clear pulse on click
    }
  };


  return (
    <div className="w-full h-full relative overflow-hidden pt-16" style={{
      backgroundColor: '#0f3a24'
    }}>
      {/* Base sparse grass background */}
      <div className="absolute inset-0 opacity-15" style={{
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 24px,
            rgba(16, 64, 36, 0.1) 24px,
            rgba(16, 64, 36, 0.1) 48px
          ),
          repeating-linear-gradient(
            90deg,
            transparent 0px,
            transparent 24px,
            rgba(16, 64, 36, 0.1) 24px,
            rgba(16, 64, 36, 0.1) 48px
          ),
          linear-gradient(
            0deg,
            #1e5a3a 0%,
            #1a4d2e 50%,
            #16452a 100%
          )
        `,
        backgroundSize: '48px 48px, 48px 48px, 100% 100%',
      }}></div>

      {/* Dynamic grass growth around clusters */}
      {grassAreas.map((area, index) => {
        const intensity = Math.min(area.size / 5, 1); // Max at 5 tokens
        const radius = 150 + (area.size * 30); // Bigger clusters = bigger grass area

        if (area.isWilted) {
          // Wilted brown-red grass
          return (
            <div
              key={`wilt-${index}`}
              className="absolute pointer-events-none transition-opacity duration-1000"
              style={{
                left: `${area.x}px`,
                top: `${area.y}px`,
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: `radial-gradient(circle at center,
                  rgba(139, 69, 19, ${0.3 * intensity}) 0%,
                  rgba(160, 82, 45, ${0.25 * intensity}) 30%,
                  rgba(178, 34, 34, ${0.15 * intensity}) 60%,
                  transparent 100%
                )`,
                opacity: 0.6,
              }}
            >
              {/* Wilted grass texture */}
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundImage: `
                  radial-gradient(circle at 50% 30%, rgba(139, 69, 19, 0.15) 2px, transparent 2px),
                  radial-gradient(circle at 50% 70%, rgba(160, 82, 45, 0.12) 2px, transparent 2px),
                  radial-gradient(circle at 30% 50%, rgba(178, 34, 34, 0.1) 2px, transparent 2px),
                  radial-gradient(circle at 70% 50%, rgba(139, 69, 19, 0.1) 2px, transparent 2px)
                `,
                backgroundSize: '30px 30px',
                backgroundPosition: 'center',
              }}></div>
            </div>
          );
        }

        // Healthy green grass
        return (
          <div
            key={`grass-${index}`}
            className="absolute pointer-events-none transition-opacity duration-1000"
            style={{
              left: `${area.x}px`,
              top: `${area.y}px`,
              width: `${radius * 2}px`,
              height: `${radius * 2}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle at center,
                rgba(34, 197, 94, ${0.4 * intensity}) 0%,
                rgba(16, 185, 129, ${0.3 * intensity}) 40%,
                rgba(34, 197, 94, ${0.2 * intensity}) 70%,
                transparent 100%
              )`,
              opacity: 0.8,
            }}
          >
            {/* Dense grass blades */}
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundImage: `
                radial-gradient(circle at 50% 20%, rgba(34, 197, 94, ${0.2 * intensity}) 3px, transparent 3px),
                radial-gradient(circle at 50% 50%, rgba(16, 185, 129, ${0.15 * intensity}) 3px, transparent 3px),
                radial-gradient(circle at 50% 80%, rgba(34, 197, 94, ${0.18 * intensity}) 2px, transparent 2px),
                radial-gradient(circle at 20% 50%, rgba(16, 185, 129, ${0.12 * intensity}) 2px, transparent 2px),
                radial-gradient(circle at 80% 50%, rgba(34, 197, 94, ${0.14 * intensity}) 2px, transparent 2px)
              `,
              backgroundSize: '24px 24px',
              backgroundPosition: 'center',
            }}></div>
          </div>
        );
      })}

      <div ref={canvasRef} className="w-full h-full relative" onClick={handleCanvasClick}>
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Cursor wave ripple from random token */}
        {cursorPulse && mousePos && (() => {
          const token = tokens.find(t => t.id === cursorPulse.tokenId);
          if (!token) return null;

          // Calculate angle from token to cursor
          const angle = Math.atan2(mousePos.y - token.y, mousePos.x - token.x);
          const angleDeg = (angle * 180) / Math.PI;

          const radius = 25;

          return (
            <g key="cursor-wave">
              {/* Traveling semi-circles (half circles) */}
              {[0, 1, 2, 3, 4].map(i => (
                <g key={`traveling-${i}`}>
                  <path
                    d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius}`}
                    fill="none"
                    stroke="rgba(34, 211, 238, 0.9)"
                    strokeWidth="3"
                  >
                    <animateMotion
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin={`${i * 0.5}s`}
                      rotate="auto"
                    >
                      <mpath href="#wave-path" />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      keyTimes="0;0.15;0.75;1"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin={`${i * 0.5}s`}
                    />
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values="0.3;1.5"
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin={`${i * 0.5}s`}
                      additive="sum"
                    />
                  </path>
                </g>
              ))}

              {/* Define the path from token to cursor */}
              <path
                id="wave-path"
                d={`M ${token.x} ${token.y} L ${mousePos.x} ${mousePos.y}`}
                fill="none"
                stroke="none"
              />

              {/* Impact at cursor */}
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

        {connections.map(({ from, to }) => {
          const token1 = tokens.find((t) => t.id === from);
          const token2 = tokens.find((t) => t.id === to);
          if (!token1 || !token2) return null;
          return (
            <g key={`${from}-${to}`}>
              <line
                x1={token1.x}
                y1={token1.y}
                x2={token2.x}
                y2={token2.y}
                stroke="rgba(52, 211, 153, 0.6)"
                strokeWidth="2.5"
                strokeDasharray="5, 5"
                strokeDashoffset="0"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="10"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </line>
              {/* Glow effect */}
              <line
                x1={token1.x}
                y1={token1.y}
                x2={token2.x}
                y2={token2.y}
                stroke="rgba(52, 211, 153, 0.2)"
                strokeWidth="5"
                className="animate-pulse"
              />
            </g>
          );
        })}

        {/* Random suggestion pulse lines */}
        {randomSuggestions.size > 1 && Array.from(randomSuggestions).map((tokenId, idx, arr) => {
          if (idx === arr.length - 1) return null;
          const token1 = tokens.find(t => t.id === tokenId);
          const token2 = tokens.find(t => t.id === arr[idx + 1]);
          if (!token1 || !token2) return null;

          return (
            <line
              key={`pulse-${tokenId}-${arr[idx + 1]}`}
              x1={token1.x}
              y1={token1.y}
              x2={token2.x}
              y2={token2.y}
              stroke="rgba(250, 204, 21, 0.7)"
              strokeWidth="3.5"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          );
        })}
      </svg>

      {/* Tokens */}
      {tokens.map((token) => (
        <Token
          key={token.id}
          id={token.id}
          x={token.x}
          y={token.y}
          label={token.label}
          description={token.description}
          isConnected={connectedTokenIds.has(token.id)}
          isPulsing={randomSuggestions.has(token.id)}
          allTokens={tokens.map(t => ({ id: t.id, x: t.x, y: t.y }))}
          onMove={handleMove}
          onDescriptionChange={updateTokenDescription}
          scale={token.scale || 1}
          onScaleChange={scaleMode ? handleScaleChange : undefined}
        />
      ))}

      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-3">
        <button
          onClick={() => {
            setCursorPulse(null);
            setScaleMode(!scaleMode);
          }}
          className={`group px-5 py-2.5 rounded-lg transition-all duration-300 shadow-lg font-medium hover:scale-105 active:scale-95 ${
            scaleMode
              ? 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white shadow-yellow-500/50'
              : 'bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/50'
          }`}
          title="Toggle scale mode (S)"
        >
          <span className="inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            <span>{scaleMode ? 'Scale ON' : 'Scale'}</span>
          </span>
        </button>

        <button
          onClick={addToken}
          className="group px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-emerald-500/50 font-medium hover:scale-105 active:scale-95"
        >
          <span className="inline-flex items-center gap-2">
            <span className="text-lg group-hover:rotate-90 transition-transform duration-300">+</span>
            <span>Add Idea</span>
          </span>
        </button>
      </div>

      {/* Cursor suggestion tooltip */}
      {cursorPulse && mousePos && (
        <div
          className="absolute pointer-events-none z-50 animate-fadeIn"
          style={{
            left: `${mousePos.x}px`,
            top: `${mousePos.y - 60}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-gradient-to-br from-cyan-900 to-sky-900 backdrop-blur-md px-4 py-3 rounded-xl border border-cyan-500/50 shadow-2xl shadow-cyan-500/40 max-w-xs">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="text-cyan-100 text-sm font-medium leading-tight">
                {cursorPulse.suggestion}
              </p>
            </div>
          </div>
          {/* Arrow pointing to cursor */}
          <div className="w-3 h-3 bg-cyan-900 border-r border-b border-cyan-500/50 transform rotate-45 mx-auto mt-[-6px]"></div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-emerald-900/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-emerald-700/50 shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105">
        <p className="text-emerald-200 text-sm">
          <span className="text-emerald-400 font-semibold">Drag</span> to move •
          {scaleMode && <><span className="text-yellow-400 font-semibold">Scroll</span> on token to resize •</>}
          <span className="text-emerald-400 font-semibold">Connect</span> by proximity •
          <span className="text-cyan-400 font-semibold">Watch</span> for cursor pulses
        </p>
      </div>
      </div>
    </div>
  );
}

export type { TokenData };
