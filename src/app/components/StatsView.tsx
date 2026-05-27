import { useEffect, useState } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Sprout, Users, Bus, Clover, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

function formatTimeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
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
}

export function StatsView() {
  const navigate = useNavigate();
  const { tokens, clusters, events, sessionId } = useTokens();
  const [timeState, setTimeState] = useState(Date.now());

  useEffect(() => {
    document.title = "MOBUS - Statistieken";
    const interval = setInterval(() => {
      setTimeState(Date.now());
    }, 30000); // refresh time ago every 30s
    return () => clearInterval(interval);
  }, []);

  // Calculate statistics
  const totalIdeas = tokens.length;
  const totalClusters = clusters.length;
  
  // Input mobus (table scanner / simulation)
  const mobusInputs = tokens.filter(t => 
    t.source === 'table' || 
    t.source === 'simulation' || 
    !t.source // fallback to table
  ).length;

  // Unclustered ideas
  const standaloneIdeas = tokens.filter(t => !t.clusterId).length;

  // Clean event message for Dutch presentation
  const getEventDescription = (event: any) => {
    const msg = event.message || "";
    // If it starts with standard English created message, translate it nicely
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
    // Keep it reactive to timeState
    const dummy = timeState;
    return formatTimeAgo(timestamp);
  };

  return (
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-50 font-sans p-6 md:p-8 flex flex-col items-center select-none overflow-auto">
      {/* Subtle back navigation helper for devs/setup */}
      <div className="w-full max-w-md flex justify-between items-center mb-6 opacity-40 hover:opacity-100 transition-opacity">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>
        <span className="text-[10px] font-mono text-zinc-400">
          Sessie: {sessionId.replace(/^mobus-/, '')}
        </span>
      </div>

      <div className="w-full max-w-md flex-1 flex flex-col gap-8">
        
        {/* Recente activiteiten */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100">
            Recente activiteiten
          </h2>
          
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 flex flex-col divide-y divide-zinc-800/60">
            {events.length === 0 ? (
              <div className="text-center py-8 text-sm text-zinc-500">
                Nog geen activiteiten in deze sessie
              </div>
            ) : (
              events.slice(0, 4).map((event, idx) => (
                <div key={event.id || idx} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1">
                  <span className="text-sm font-medium text-zinc-200">
                    {getEventDescription(event)}
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    {getEventTimeLabel(event.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>

          <button className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded bg-zinc-900 border border-zinc-800/80 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer">
            <Clock size={14} className="text-emerald-400" />
            Bekijk alle activiteiten
          </button>
        </section>

        {/* Overzicht */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-100">
            Overzicht
          </h2>

          <div className="grid grid-cols-2 gap-4">
            
            {/* Totaal aantal ideeën */}
            <div className="bg-zinc-900/40 border border-emerald-950/40 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-emerald-950/30 border border-emerald-800/20 flex items-center justify-center text-emerald-400">
                <Sprout size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-semibold leading-snug">
                  Totaal aantal ideeën
                </span>
                <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                  {totalIdeas}
                </span>
              </div>
            </div>

            {/* Aantal clusters */}
            <div className="bg-zinc-900/40 border border-blue-950/40 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-blue-950/30 border border-blue-800/20 flex items-center justify-center text-blue-400">
                <Users size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-semibold leading-snug">
                  Aantal clusters
                </span>
                <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                  {totalClusters}
                </span>
              </div>
            </div>

            {/* Input mobus gebruikt */}
            <div className="bg-zinc-900/40 border border-yellow-950/40 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-yellow-950/30 border border-yellow-800/20 flex items-center justify-center text-yellow-400">
                <Bus size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-semibold leading-snug">
                  Input mobus gebruikt
                </span>
                <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                  {mobusInputs}
                </span>
              </div>
            </div>

            {/* Aantal losstaande ideeën */}
            <div className="bg-zinc-900/40 border border-pink-950/40 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-xl pointer-events-none" />
              <div className="w-10 h-10 rounded-lg bg-pink-950/30 border border-pink-800/20 flex items-center justify-center text-pink-400">
                <Clover size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-semibold leading-snug">
                  Aantal losstaande ideeën
                </span>
                <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                  {standaloneIdeas}
                </span>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
