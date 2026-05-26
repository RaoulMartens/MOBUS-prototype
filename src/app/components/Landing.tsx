import { useState, useEffect } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { TokenClusteringCanvas } from './TokenClusteringCanvas';
import { SystemInsights } from './SystemInsights';
import {
  ArrowLeft,
  Check,
  Columns,
  Copy,
  ExternalLink,
  Play
} from 'lucide-react';
import { useNavigate } from 'react-router';

interface LandingProps {
  onEnter: () => void;
}

export function Landing({ onEnter }: LandingProps) {
  const { updateSessionId } = useTokens();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showSplitScreen, setShowSplitScreen] = useState(false);

  const [sessionCode, setSessionCode] = useState(() => {
    const lastSession = localStorage.getItem("sessionId");
    if (lastSession && lastSession.startsWith("mobus-")) {
      const code = lastSession.replace("mobus-", "");
      if (/^\d{4}$/.test(code)) return code;
    }
    return String(Math.floor(1000 + Math.random() * 9000));
  });

  useEffect(() => {
    updateSessionId(`mobus-${sessionCode}`);
  }, [sessionCode]);

  useEffect(() => {
    if (showSplitScreen) {
      document.title = "MOBUS - Demo Modus";
    } else {
      document.title = "MOBUS - Setup";
    }
  }, [showSplitScreen]);

  const sessionId = `mobus-${sessionCode}`;
  const phoneUrl = `${window.location.origin}/phone?sessionId=${sessionId}`;
  const tableUrl = `/table?sessionId=${sessionId}`;
  const overviewUrl = `/dev/wall?sessionId=${sessionId}`;

  const handleCodeChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setSessionCode(clean);
  };

  const handleNewSession = () => {
    const newCode = String(Math.floor(1000 + Math.random() * 9000));
    setSessionCode(newCode);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunchAll = () => {
    window.open(`${window.location.origin}${tableUrl}`, '_blank');
    window.open(`${window.location.origin}${overviewUrl}`, '_blank');
  };

  if (showSplitScreen) {
    return (
      <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 flex flex-col">
        <div className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 z-50">
          <button
            onClick={() => setShowSplitScreen(false)}
            className="text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white transition-colors flex items-center gap-2 text-sm font-bold cursor-pointer"
          >
            <ArrowLeft size={16} />
            Terug
          </button>
          <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-50">
            Sessie {sessionCode}
          </span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 h-full border-r border-zinc-200 dark:border-zinc-800 relative">
            <div className="absolute top-4 left-4 z-50 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded">
              Tafelscherm
            </div>
            <TokenClusteringCanvas />
          </div>

          <div className="w-1/2 h-full relative">
            <div className="absolute top-4 left-4 z-50 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded">
              Muurscherm
            </div>
            <SystemInsights />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 overflow-auto">
      <div className="min-h-full max-w-4xl mx-auto px-6 py-8 flex flex-col">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="group flex items-center gap-2 text-zinc-650 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors text-sm font-bold cursor-pointer"
          >
            <ArrowLeft size={16} />
            Terug
          </button>
          <button
            onClick={handleNewSession}
            className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-colors"
          >
            Nieuwe sessie
          </button>
        </div>

        <main className="flex-1 flex items-center justify-center py-14">
          <div className="w-full max-w-2xl text-center">
            <div className="mb-10">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 mb-4">
                Start je ideeënsessie
              </h1>
              <p className="text-base md:text-lg text-zinc-600 dark:text-zinc-350">
                Verbind je telefoon en breng ideeën naar de interactieve tafel.
              </p>
            </div>

            <button
              onClick={handleLaunchAll}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded bg-zinc-950 px-8 py-4 text-base font-bold text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-colors"
            >
              Start tafel + muur
              <ExternalLink size={18} />
            </button>

            <section className="mt-10 rounded bg-white dark:bg-zinc-900 px-6 py-7 md:px-10 md:py-9 text-left shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                    Stap 2
                  </p>
                  <h2 className="text-2xl font-black text-zinc-950 dark:text-zinc-50 mb-3">
                    Verbind je telefoon
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-350 max-w-md leading-relaxed">
                    Gebruik je telefoon om ideeën toe te voegen. Ze verschijnen automatisch op tafel.
                  </p>
                  <a
                    href={phoneUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-mono font-bold text-zinc-950 dark:text-zinc-50 underline underline-offset-4"
                  >
                    {phoneUrl}
                    <ExternalLink size={14} />
                  </a>
                </div>

                <div className="md:min-w-48 rounded bg-zinc-50 dark:bg-zinc-950 px-6 py-5 text-center flex flex-col items-center">
                  <span className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Sessiecode
                  </span>
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="w-32 bg-transparent text-center text-4xl font-black font-mono tracking-widest text-zinc-950 dark:text-zinc-50 border-b border-zinc-300 focus:border-zinc-950 dark:focus:border-zinc-50 outline-none pb-1"
                    maxLength={4}
                    placeholder="0000"
                  />
                  <div className="flex gap-4 mt-4">
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Gekopieerd' : 'Kopieer'}
                    </button>
                    <button
                      onClick={handleNewSession}
                      className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span>Nieuw</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Geavanceerd
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm">
                <a
                  href={tableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors"
                >
                  Open tafelscherm los
                  <ExternalLink size={13} />
                </a>
                <a
                  href={overviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors"
                >
                  Open muurscherm los
                  <ExternalLink size={13} />
                </a>
                <button
                  onClick={() => setShowSplitScreen(true)}
                  className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50 transition-colors cursor-pointer"
                >
                  Demo-modus
                  <Columns size={13} />
                  <Play size={12} />
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
