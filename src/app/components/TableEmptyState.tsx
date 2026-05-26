import { useEffect, useState } from 'react';

export function TableEmptyState() {
  const [showTumbleweed, setShowTumbleweed] = useState(false);

  useEffect(() => {
    // Tumbleweed appears after 4 seconds
    const timer = setTimeout(() => {
      setShowTumbleweed(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden bg-zinc-50/40">
      
      {/* CSS Styles for Tumbleweed and Table Grid */}
      <style>{`
        @keyframes tumbleweed-roll {
          0% {
            left: -15%;
            top: 35%;
            transform: rotate(0deg) scale(1);
            opacity: 0;
          }
          1% {
            opacity: 0.35;
          }
          3% {
            opacity: 0.55;
          }
          37% {
            opacity: 0.55;
          }
          39% {
            opacity: 0.35;
          }
          40%, 100% {
            left: 115%;
            top: 55%;
            transform: rotate(1440deg) scale(1);
            opacity: 0;
          }
        }

        @keyframes dust-fade {
          0%, 40%, 100% {
            opacity: 0;
            transform: scale(0.4);
          }
          5%, 35% {
            opacity: 0.3;
            transform: scale(0.6);
          }
        }

        .tumbleweed-main {
          position: absolute;
          width: 80px;
          height: 80px;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite;
          animation-delay: 4s;
          z-index: 5;
        }

        /* Delayed dust particles for realistic trailing effect behind larger tumbleweed */
        .tumbleweed-dust-1 {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #d4d4d8;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.08s;
          margin-top: 36px;
          margin-left: -20px;
          z-index: 4;
        }

        .tumbleweed-dust-2 {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #e4e4e7;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.16s;
          margin-top: 48px;
          margin-left: -32px;
          z-index: 4;
        }

        .tumbleweed-dust-3 {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d4d4d8;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.24s;
          margin-top: 24px;
          margin-left: -44px;
          z-index: 4;
        }
      `}</style>

      {/* Multi-sided orientation markings */}
      
      {/* Top Edge (Noord - Rotated 180deg) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 rotate-180 flex flex-col items-center gap-1 opacity-20">
        <span className="text-[9px] font-black tracking-widest text-zinc-550 uppercase">TAFEL · NOORD</span>
        <div className="w-8 h-px bg-zinc-400" />
      </div>

      {/* Bottom Edge (Zuid - Normal) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-20">
        <div className="w-8 h-px bg-zinc-400" />
        <span className="text-[9px] font-black tracking-widest text-zinc-550 uppercase">TAFEL · ZUID</span>
      </div>

      {/* Left Edge (West - Rotated 90deg CW) */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 rotate-90 flex flex-col items-center gap-1 opacity-20">
        <span className="text-[9px] font-black tracking-widest text-zinc-550 uppercase">TAFEL · WEST</span>
        <div className="w-8 h-px bg-zinc-400" />
      </div>

      {/* Right Edge (Oost - Rotated 270deg CW) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 -rotate-90 flex flex-col items-center gap-1 opacity-20">
        <span className="text-[9px] font-black tracking-widest text-zinc-550 uppercase">TAFEL · OOST</span>
        <div className="w-8 h-px bg-zinc-400" />
      </div>

      {/* Subtle corner ticks */}
      <div className="absolute top-8 left-8 w-6 h-6 border-t border-l border-zinc-200 dark:border-zinc-800/40 opacity-40" />
      <div className="absolute top-8 right-8 w-6 h-6 border-t border-r border-zinc-200 dark:border-zinc-800/40 opacity-40" />
      <div className="absolute bottom-8 left-8 w-6 h-6 border-b border-l border-zinc-200 dark:border-zinc-800/40 opacity-40" />
      <div className="absolute bottom-8 right-8 w-6 h-6 border-b border-r border-zinc-200 dark:border-zinc-800/40 opacity-40" />

      {/* Subtle center marker (tiny crosshair) - Absolutely centered */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 opacity-10 flex items-center justify-center">
        <div className="absolute w-4 h-px bg-zinc-950" />
        <div className="absolute h-4 w-px bg-zinc-950" />
        <div className="w-1.5 h-1.5 rounded-full border border-zinc-950 bg-transparent" />
      </div>

      {/* Central Quiet Text - Absolutely centered */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md text-center px-6 animate-fade-in transition-all duration-1000 z-10">
        <h2 className="text-xl md:text-2xl font-black text-zinc-400 dark:text-zinc-650 tracking-tight mb-2">
          Nog geen ideeën op tafel
        </h2>
        <p className="text-xs md:text-sm text-zinc-400/80 dark:text-zinc-500 font-medium">
          Voeg een idee toe via je telefoon.
        </p>
      </div>

      {/* CSS-Animated Tumbleweed and Dust Trail */}
      {showTumbleweed && (
        <>
          {/* Dust Trail */}
          <div className="tumbleweed-dust-1" />
          <div className="tumbleweed-dust-2" />
          <div className="tumbleweed-dust-3" />

          {/* Larger, messy, realistic tumbleweed */}
          <div className="tumbleweed-main">
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-zinc-400 dark:stroke-zinc-600 fill-none stroke-[2] stroke-round">
              {/* Outer twig circle ring */}
              <circle cx="50" cy="50" r="44" strokeDasharray="3 6" className="opacity-30" />
              <circle cx="48" cy="52" r="39" className="opacity-45" />
              <circle cx="52" cy="48" r="36" className="opacity-30" />
              
              {/* Concentric organic swirls/spirals */}
              <path d="M 50,10 C 72,10 90,28 90,50 C 90,72 72,90 50,90 C 28,90 10,72 10,50 C 10,32 25,15 45,15 C 60,15 75,25 78,42 C 80,55 70,72 55,75 C 42,78 28,68 25,52 C 22,40 32,28 45,28 C 55,28 65,35 65,48 C 65,58 55,62 48,58" />
              
              {/* Intersecting branch clusters */}
              <path d="M 9,45 Q 50,5 91,45" />
              <path d="M 9,55 Q 50,95 91,55" />
              <path d="M 45,9 Q 5,50 45,91" />
              <path d="M 55,9 Q 95,50 55,91" />

              {/* Smaller loops inside */}
              <path d="M 30,30 Q 50,15 70,30" />
              <path d="M 30,70 Q 50,85 70,70" />
              <path d="M 30,30 Q 15,50 30,70" />
              <path d="M 70,30 Q 85,50 70,70" />
              
              {/* Spikey twig ends sticking out */}
              <path d="M 12,30 L 2,24" />
              <path d="M 88,30 L 98,24" />
              <path d="M 12,70 L 2,76" />
              <path d="M 88,70 L 98,76" />
              <path d="M 30,12 L 24,2" />
              <path d="M 70,12 L 76,2" />
              <path d="M 30,88 L 24,98" />
              <path d="M 70,88 L 76,98" />
              
              <path d="M 50,10 L 52,2" />
              <path d="M 50,90 L 48,98" />
              <path d="M 10,50 L 2,52" />
              <path d="M 90,50 L 98,48" />
            </svg>
          </div>
        </>
      )}

    </div>
  );
}
