import { useEffect, useState } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Sprout, Users, Smartphone, Clover, Clock, ArrowLeft, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router';

function formatTimeAgo(timestamp: string): string {
  try {
    if (!timestamp) return "Zojuist";
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "Zojuist";
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Zojuist";
    if (diffMins === 1) return "1 minuut geleden";
    if (diffMins < 60) return `${diffMins} minuten geleden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 uur geleden";
    if (diffHours < 24) return `${diffHours} uur geleden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 dag geleden";
    return `${diffDays} dagen geleden`;
  } catch (e) {
    return "Zojuist";
  }
}

export function StatsView() {
  try {
    return <StatsViewInner />;
  } catch (error: any) {
    return (
      <div className="p-8 bg-zinc-950 text-red-500 font-mono min-h-screen">
        <h1 className="text-xl font-bold mb-4">Rendering Error in StatsView:</h1>
        <pre className="bg-zinc-900 p-4 border border-zinc-800 rounded">{error?.stack || error?.message || String(error)}</pre>
      </div>
    );
  }
}

function StatsViewInner() {
  const navigate = useNavigate();
  
  // Safe context extraction
  let context: any;
  try {
    context = useTokens();
  } catch (e) {
    context = null;
  }

  const tokens = context?.tokens || [];
  const clusters = context?.clusters || [];
  const events = context?.events || [];
  const sessionId = context?.sessionId || "";

  const [timeState, setTimeState] = useState(Date.now());

  // Rotation state: 0, 90, 180, 270
  const [rotation, setRotation] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const rParam = params.get('rotate');
    if (rParam === '90') return 90;
    if (rParam === '270' || rParam === '-90') return 270;
    if (rParam === '180') return 180;
    
    const stored = localStorage.getItem('stats_rotation');
    if (stored === '90') return 90;
    if (stored === '270') return 270;
    if (stored === '180') return 180;
    
    return 0;
  });

  useEffect(() => {
    if (rotation === 0) {
      localStorage.removeItem('stats_rotation');
    } else {
      localStorage.setItem('stats_rotation', String(rotation));
    }
  }, [rotation]);

  const cycleRotation = () => {
    setRotation(prev => {
      if (prev === 0) return 90;
      if (prev === 90) return 180;
      if (prev === 180) return 270;
      return 0;
    });
  };

  const getContainerStyle = (): React.CSSProperties => {
    if (rotation === 90) {
      return {
        transform: 'rotate(90deg)',
        width: '100vh',
        height: '100vw',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transformOrigin: 'center',
        translate: '-50% -50%',
      };
    }
    if (rotation === 270) {
      return {
        transform: 'rotate(270deg)',
        width: '100vh',
        height: '100vw',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transformOrigin: 'center',
        translate: '-50% -50%',
      };
    }
    if (rotation === 180) {
      return {
        transform: 'rotate(180deg)',
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transformOrigin: 'center',
        translate: '-50% -50%',
      };
    }
    return {};
  };

  useEffect(() => {
    document.title = "MOBUS - Statistieken";
    const interval = setInterval(() => {
      setTimeState(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate spatial clusters (distance < 140) and standalone ideas dynamically
  const SNAP_DISTANCE = 140;
  const visited = new Set<string>();
  let proximityClustersCount = 0;
  let standaloneIdeasCount = 0;

  for (const token of tokens) {
    if (!token || !token.id) continue;
    if (visited.has(token.id)) continue;

    const component: any[] = [];
    const queue = [token];
    visited.add(token.id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);

      for (const other of tokens) {
        if (!other || !other.id || visited.has(other.id)) continue;
        
        const dist = Math.sqrt(
          Math.pow((curr.position?.x || 0) - (other.position?.x || 0), 2) +
          Math.pow((curr.position?.y || 0) - (other.position?.y || 0), 2)
        );

        if (dist < SNAP_DISTANCE) {
          visited.add(other.id);
          queue.push(other);
        }
      }
    }

    if (component.length >= 2) {
      proximityClustersCount++;
    } else {
      standaloneIdeasCount++;
    }
  }

  const totalIdeas = tokens.length;
  const totalClusters = proximityClustersCount;
  const standaloneIdeas = standaloneIdeasCount;

  // Phone inputs
  const phoneInputs = tokens.filter((t: any) => 
    t && (t.source === 'phone' || t.source === 'admin')
  ).length;

  // Clean event message for Dutch presentation
  const getEventDescription = (event: any) => {
    if (!event) return "";
    const msg = event.message || "";
    if (msg.startsWith("New token \"") && msg.endsWith("\" created")) {
      const tokenName = msg.substring(11, msg.length - 10);
      return `Idee '${tokenName}' geplaatst`;
    }
    if (msg.includes("tokens clustered into")) {
      const parts = msg.split(" clustered into ");
      const clusterName = parts[1]?.replace(/"/g, "") || "";
      return `Cluster '${clusterName}' gevormd`;
    }
    return msg;
  };

  const getEventTimeLabel = (timestamp: string) => {
    const dummy = timeState;
    return formatTimeAgo(timestamp);
  };

  const displaySessionCode = sessionId ? sessionId.replace(/^mobus-/, '') : 'tafel-88';

  const hasRotation = rotation !== 0;

  const content = (
    <div 
      className={`bg-background text-foreground font-sans p-6 md:p-8 flex flex-col items-center select-none ${hasRotation ? 'w-full h-full overflow-auto' : 'w-full min-h-screen overflow-auto'}`}
      style={getContainerStyle()}
    >
      {/* Subtle back navigation helper for devs/setup */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 opacity-60 hover:opacity-100 transition-opacity">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-bold"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>
        <span className="text-[10px] font-mono text-muted-foreground font-bold">
          Sessie: {displaySessionCode}
        </span>
      </div>

      <div className="w-full max-w-md flex-1 flex flex-col gap-8">
        
        {/* Recente activiteiten */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Recente activiteiten
          </h2>
          
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col divide-y divide-border">
            {events.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nog geen activiteiten in deze sessie
              </div>
            ) : (
              events.slice(0, 4).map((event: any, idx: number) => (
                <div key={event.id || idx} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">
                    {getEventDescription(event)}
                  </span>
                  <span className="text-xs text-[#22c55e] font-semibold">
                    {getEventTimeLabel(event.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>

          <button className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded bg-secondary text-secondary-foreground border border-border text-xs font-bold hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
            <Clock size={14} className="text-[#22c55e]" />
            Bekijk alle activiteiten
          </button>
        </section>

        {/* Overzicht */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Overzicht
          </h2>

          <div className="grid grid-cols-2 gap-4">
            
            {/* Totaal aantal ideeën */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#22c55e]/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">
                <Sprout size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground font-semibold leading-snug">
                  Totaal aantal ideeën
                </span>
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {totalIdeas}
                </span>
              </div>
            </div>

            {/* Aantal clusters */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#3b82f6]/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-[#3b82f6]">
                <Users size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground font-semibold leading-snug">
                  Aantal clusters
                </span>
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {totalClusters}
                </span>
              </div>
            </div>

            {/* Ingevoerd via telefoon */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#eab308]/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-[#eab308]/10 border border-[#eab308]/20 flex items-center justify-center text-[#eab308]">
                <Smartphone size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground font-semibold leading-snug">
                  Ingevoerd via telefoon
                </span>
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {phoneInputs}
                </span>
              </div>
            </div>

            {/* Aantal losstaande ideeën */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#ec4899]/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-[#ec4899]/10 border border-[#ec4899]/20 flex items-center justify-center text-[#ec4899]">
                <Clover size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground font-semibold leading-snug">
                  Aantal losstaande ideeën
                </span>
                <span className="text-4xl font-extrabold text-foreground tracking-tight">
                  {standaloneIdeas}
                </span>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );

  if (hasRotation) {
    return (
      <div className="w-screen h-screen overflow-hidden bg-background relative">
        {content}
        <button
          onClick={cycleRotation}
          className="absolute bottom-6 right-6 p-3 rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer z-50 flex items-center justify-center"
          title="Draai scherm"
        >
          <RotateCw size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      {content}
      <button
        onClick={cycleRotation}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer z-50 flex items-center justify-center"
        title="Draai scherm"
      >
        <RotateCw size={18} />
      </button>
    </>
  );
}
