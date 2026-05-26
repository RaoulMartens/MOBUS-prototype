import { useEffect, useRef } from 'react';

export function TableEmptyState() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationId: number;
    let initialized = false;
    let x = 0;
    let y = 0;

    // Slow and subtle movement: between 0.6 and 1.0 px per frame
    let dx = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.4);
    let dy = (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.4);

    const update = () => {
      const container = containerRef.current;
      const textNode = textRef.current;
      if (!container || !textNode) {
        animationId = requestAnimationFrame(update);
        return;
      }

      const parentRect = container.getBoundingClientRect();
      const textRect = textNode.getBoundingClientRect();

      // Guard: wait until layout has loaded with realistic width
      if (parentRect.width < 400 || textRect.width === 0) {
        animationId = requestAnimationFrame(update);
        return;
      }

      // Center it initially in the container once layout is loaded
      if (!initialized) {
        x = parentRect.width / 2 - textRect.width / 2;
        y = parentRect.height / 2 - textRect.height / 2;
        initialized = true;
      }

      // Bounds with 12px padding
      const padding = 12;
      const minX = padding;
      const minY = padding;
      const maxX = parentRect.width - textRect.width - padding;
      const maxY = parentRect.height - textRect.height - padding;

      // Move coordinates
      x += dx;
      y += dy;

      // Bounce horizontal edges
      if (x <= minX) {
        x = minX;
        dx = -dx;
      } else if (x >= maxX) {
        x = maxX;
        dx = -dx;
      }

      // Bounce vertical edges
      if (y <= minY) {
        y = minY;
        dy = -dy;
      } else if (y >= maxY) {
        y = maxY;
        dy = -dy;
      }

      // Translate element directly in DOM for 60fps GPU performance
      textNode.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      animationId = requestAnimationFrame(update);
    };

    // Begin looping
    animationId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none select-none overflow-hidden bg-zinc-50/40">

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
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 opacity-10 flex items-center justify-center">
        <div className="absolute w-4 h-px bg-zinc-950" />
        <div className="absolute h-4 w-px bg-zinc-950" />
        <div className="w-1.5 h-1.5 rounded-full border border-zinc-950 bg-transparent" />
      </div>

      <style>{`
        @keyframes fadeInOnly {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-only {
          animation: fadeInOnly 0.4s ease-out forwards;
        }
      `}</style>

      {/* Moving Text Group (Bouncing standby DVD screensaver style) */}
      <div
        ref={textRef}
        className="absolute left-0 top-0 w-80 text-center px-4 z-10"
        style={{ transform: 'translate3d(50vw, 50vh, 0)' }}
      >
        <div className="animate-fade-in-only">
          <h2 className="text-xl md:text-2xl font-black text-zinc-400 dark:text-zinc-650 tracking-tight mb-2">
            Nog geen ideeën op tafel
          </h2>
          <p className="text-xs md:text-sm text-zinc-400/80 dark:text-zinc-500 font-medium">
            Voeg een idee toe via je telefoon.
          </p>
        </div>
      </div>

    </div>
  );
}
