import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  Sprout,
  GitFork,
  Sparkles,
  QrCode,
  Shield,
  UserCheck
} from 'lucide-react';
import { useTokens } from '../contexts/TokenContext';

const createSessionId = () => `mobus-${Math.floor(1000 + Math.random() * 9000)}`;

export function ExperienceInfo() {
  const navigate = useNavigate();
  const { updateSessionId } = useTokens();

  useEffect(() => {
    document.title = "MOBUS - Ecosysteem Info";
  }, []);

  const handleContinue = () => {
    const sessionId = createSessionId();
    updateSessionId(sessionId);
    navigate(`/table?sessionId=${sessionId}`);
  };

  return (
    <div className="w-full min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col relative overflow-hidden">
      
      {/* Background wireframe grid & subtle ambient glow */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent 0px, transparent 40px, #000000 40px, #000000 41px),
          repeating-linear-gradient(90deg, transparent 0px, transparent 40px, #000000 40px, #000000 41px)
        `,
        backgroundSize: '40px 40px',
      }} />
      
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-zinc-200/40 dark:bg-zinc-800/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-zinc-200/40 dark:bg-zinc-800/10 blur-[120px] pointer-events-none" />

      {/* Header / Nav */}
      <header className="h-16 flex items-center px-6 md:px-12 z-10">
        <button
          onClick={() => navigate('/')}
          className="group flex items-center gap-2 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 transition-colors text-sm font-bold cursor-pointer"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Terug naar dashboard
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 z-10 max-w-4xl mx-auto w-full">
        <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 md:p-12 shadow-sm flex flex-col items-center text-center">
          
          {/* Badge & Title */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 text-[10px] uppercase font-bold tracking-widest mb-6">
            <Sparkles size={10} />
            Ideeën ecosysteem
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-950 dark:text-zinc-50 mb-4 max-w-2xl leading-tight">
            Laat ideeën groeien en verbinden
          </h1>
          
          <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 max-w-xl mb-10 leading-relaxed">
            Ontdek nieuwe inzichten, leg verbanden en bouw samen aan een levend netwerk van ideeën.
          </p>

          {/* QR Code Visual Prompt */}
          <div className="flex flex-col items-center gap-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/60 rounded px-6 py-6 w-full max-w-md mb-10">
            <div className="relative flex items-center justify-center w-12 h-12">
              <div className="absolute inset-0 rounded-full bg-zinc-950/5 dark:bg-zinc-50/5 animate-ping opacity-75" />
              <div className="absolute inset-2 rounded-full bg-zinc-950/10 dark:bg-zinc-50/10 animate-pulse" />
              <QrCode className="w-6 h-6 text-zinc-950 dark:text-zinc-50 relative z-10" />
            </div>
            <p className="text-xs md:text-sm font-semibold tracking-wide text-zinc-950 dark:text-zinc-50">
              Scan de QR-code om te verbinden
            </p>
          </div>

          {/* Core Feature Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left mb-10 border-t border-b border-zinc-150 dark:border-zinc-800/80 py-8">
            {/* Pillar 1 */}
            <div className="flex flex-col gap-3">
              <div className="w-9 h-9 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-50">
                <Sprout size={18} />
              </div>
              <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                Ideeën planten
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Verzamel en orden gedachten op de interactieve tafel.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="flex flex-col gap-3">
              <div className="w-9 h-9 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-50">
                <GitFork size={18} className="rotate-90" />
              </div>
              <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                Verbanden ontdekken
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Zie hoe verschillende ideeën met elkaar samenhangen en groeperen.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="flex flex-col gap-3">
              <div className="w-9 h-9 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-50">
                <Sparkles size={18} />
              </div>
              <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                Ideeën laten groeien
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Werk samen en laat het AI-ecosysteem nieuwe inzichten voeden.
              </p>
            </div>
          </div>

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className="group inline-flex items-center gap-2 rounded bg-zinc-950 dark:bg-zinc-50 px-8 py-3.5 text-sm font-bold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Doorgaan
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>

        </div>
      </main>

      {/* Footer Info Banner */}
      <footer className="py-6 text-center border-t border-zinc-200 dark:border-zinc-900 z-10 px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] md:text-xs font-medium text-zinc-450 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <UserCheck size={12} className="opacity-70" />
            Geen account nodig
          </span>
          <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-full" />
          <span className="flex items-center gap-1">
            <Shield size={12} className="opacity-70" />
            Je ideeën blijven privé
          </span>
          <span className="w-1.5 h-1.5 bg-zinc-300 dark:bg-zinc-800 rounded-full" />
          <span className="flex items-center gap-1">
            <QrCode size={12} className="opacity-70" />
            Koppel via QR-code
          </span>
        </div>
      </footer>

    </div>
  );
}
