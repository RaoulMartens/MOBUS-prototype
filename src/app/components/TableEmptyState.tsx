import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';

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
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden bg-zinc-50/40">
      
      {/* CSS Styles for Tumbleweed and Table Grid */}
      <style>{`
        @keyframes tumbleweed-roll {
          0% {
            left: -10%;
            top: 35%;
            transform: rotate(0deg) scale(0.7);
            opacity: 0;
          }
          1% {
            opacity: 0.3;
          }
          3% {
            opacity: 0.45;
          }
          37% {
            opacity: 0.45;
          }
          39% {
            opacity: 0.3;
          }
          40%, 100% {
            left: 110%;
            top: 55%;
            transform: rotate(1080deg) scale(0.7);
            opacity: 0;
          }
        }

        @keyframes dust-fade {
          0%, 40%, 100% {
            opacity: 0;
            transform: scale(0.4);
          }
          5%, 35% {
            opacity: 0.25;
            transform: scale(0.6);
          }
        }

        .tumbleweed-main {
          position: absolute;
          width: 44px;
          height: 44px;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite;
          animation-delay: 4s;
          z-index: 5;
        }

        /* Delayed dust particles for realistic trailing effect */
        .tumbleweed-dust-1 {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d4d4d8;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.08s;
          margin-top: 18px;
          margin-left: -12px;
          z-index: 4;
        }

        .tumbleweed-dust-2 {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #e4e4e7;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.16s;
          margin-top: 26px;
          margin-left: -20px;
          z-index: 4;
        }

        .tumbleweed-dust-3 {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #d4d4d8;
          pointer-events: none;
          animation: tumbleweed-roll 20s linear infinite, dust-fade 20s ease-in-out infinite;
          animation-delay: 4.24s;
          margin-top: 12px;
          margin-left: -28px;
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

      {/* Subtle center marker (tiny crosshair) */}
      <div className="absolute w-6 h-6 opacity-10 flex items-center justify-center">
        <div className="absolute w-4 h-px bg-zinc-950" />
        <div className="absolute h-4 w-px bg-zinc-950" />
        <div className="w-1.5 h-1.5 rounded-full border border-zinc-950 bg-transparent" />
      </div>

      {/* Central Quiet Text */}
      <div className="max-w-md text-center px-6 animate-fade-in transition-all duration-1000 z-10">
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
          {/* Dust Trail (Delay-offset copy of coordinates) */}
          <div className="tumbleweed-dust-1" />
          <div className="tumbleweed-dust-2" />
          <div className="tumbleweed-dust-3" />

          {/* Tumbleweed Twig SVG */}
          <div className="tumbleweed-main">
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-zinc-400/80 dark:stroke-zinc-600/80 fill-none stroke-[2.5] stroke-round">
              {/* Outer twig circle ring */}
              <circle cx="50" cy="50" r="44" strokeDasharray="3 6" className="opacity-30" />
              
              {/* Main curved dry twigs/branches */}
              <path d="M 15,50 Q 50,15 85,50" />
              <path d="M 15,50 Q 50,85 85,50" />
              <path d="M 50,15 Q 15,50 50,85" />
              <path d="M 50,15 Q 85,50 50,85" />

              {/* Intersecting branch clusters */}
              <path d="M 25,25 Q 50,50 75,75" />
              <path d="M 75,25 Q 50,50 25,75" />
              <path d="M 28,38 C 38,20 62,80 72,62" />
              <path d="M 72,38 C 62,20 38,80 28,62" />

              {/* Loose ends of twigs sticking out */}
              <path d="M 15,50 L 5,48" />
              <path d="M 85,50 L 95,52" />
              <path d="M 50,15 L 52,5" />
              <path d="M 50,85 L 48,95" />
              <path d="M 25,25 L 18,18" />
              <path d="M 75,75 L 82,82" />
            </svg>
          </div>
        </>
      )}

    </div>
  );
}
