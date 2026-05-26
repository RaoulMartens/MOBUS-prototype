import { useRef, useState, useEffect, useCallback, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

interface TokenProps {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  drawingDataUrl?: string | null;
  rotation: number;
  showDrawingThumbnail?: boolean;
  isConnected: boolean;
  isPulsing: boolean;
  isYellowSuggested?: boolean;
  allTokens: Array<{ id: string; x: number; y: number }>;
  onMove: (id: string, x: number, y: number) => void;
  onRotate: (id: string, rotation: number) => void;
  onRelease: (id: string, x: number, y: number) => void;
  onScale?: (id: string, scale: number) => void;
  scale?: number;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  isDimmed?: boolean;
  status?: string;
  ai_metadata?: {
    title: string;
    summary: string;
    interpretation?: string;
    category: string;
    perspective: string;
    tags: string[];
    confidence: number;
    cluster_name?: string | null;
    creative_intent: string;
    possible_connections: string[];
  } | null;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 3.0;

export function Token({
  id,
  x,
  y,
  label,
  description,
  drawingDataUrl = null,
  rotation,
  showDrawingThumbnail = false,
  isConnected,
  isPulsing,
  isYellowSuggested = false,
  onMove,
  onRotate,
  onRelease,
  onScale,
  scale = 1,
  isSelected,
  onSelect,
  isDimmed = false,
  status = "active",
  ai_metadata = null,
}: TokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);   // any pointer down
  const [isHovered, setIsHovered] = useState(false);
  const [justCreated, setJustCreated] = useState(true);

  // Per-token active pointer map: pointerId -> {clientX, clientY}
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Gesture baseline (set when 2nd finger lands or drag starts)
  const gesture = useRef<{
    mode: 'drag' | 'transform';
    // drag
    startClientX: number;
    startClientY: number;
    startTokenX: number;
    startTokenY: number;
    // transform baseline
    initDist: number;
    initAngle: number;
    initScale: number;
    initRotation: number;
    initCenterX: number; // token x when transform started
    initCenterY: number;
    // tap detection
    downTime: number;
    downClientX: number;
    downClientY: number;
  } | null>(null);

  // Entry animation
  useEffect(() => {
    const timer = setTimeout(() => setJustCreated(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const getPointerPair = () => {
    const pts = Array.from(pointers.current.values());
    return pts.length >= 2 ? pts : null;
  };

  const getPairDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y);

  const getPairAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);

  const normalizeRotation = (v: number) =>
    Math.round((((v % 360) + 360) % 360) * 10) / 10;

  const toParentCoords = (clientX: number, clientY: number) => {
    const parent = ref.current?.parentElement;
    if (!parent) return { x: clientX, y: clientY };
    const rect = parent.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  // ── Drag mode baseline ──────────────────────────────────────────────────────
  const startDrag = (clientX: number, clientY: number) => {
    gesture.current = {
      mode: 'drag',
      startClientX: clientX,
      startClientY: clientY,
      startTokenX: x,
      startTokenY: y,
      initDist: 0,
      initAngle: 0,
      initScale: scale,
      initRotation: rotation,
      initCenterX: x,
      initCenterY: y,
      downTime: Date.now(),
      downClientX: clientX,
      downClientY: clientY,
    };
  };

  // ── Transform mode baseline ─────────────────────────────────────────────────
  const startTransform = (pts: { x: number; y: number }[]) => {
    const [a, b] = pts;
    gesture.current = {
      mode: 'transform',
      startClientX: 0,
      startClientY: 0,
      startTokenX: x,
      startTokenY: y,
      initDist: getPairDist(a, b),
      initAngle: getPairAngle(a, b),
      initScale: scale,
      initRotation: rotation,
      initCenterX: x,
      initCenterY: y,
      downTime: gesture.current?.downTime ?? Date.now(),
      downClientX: gesture.current?.downClientX ?? (a.x + b.x) / 2,
      downClientY: gesture.current?.downClientY ?? (a.y + b.y) / 2,
    };
  };

  // ── Pointer down ────────────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsActive(true);
    onSelect(id);

    const pts = Array.from(pointers.current.values());

    if (pts.length >= 2) {
      // 2nd finger — switch to transform
      startTransform(pts);
    } else {
      // 1st finger — drag
      startDrag(e.clientX, e.clientY);
    }
  }, [x, y, scale, rotation, id]);

  // ── Pointer move ────────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    e.preventDefault();

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gesture.current;
    if (!g) return;

    const pts = Array.from(pointers.current.values());

    if (pts.length >= 2) {
      // ── Two-finger: rotate + scale + translate ───────────────────────────
      if (g.mode !== 'transform') {
        startTransform(pts);
        return;
      }

      const [a, b] = pts;
      const currentDist = getPairDist(a, b);
      const currentAngle = getPairAngle(a, b);

      const distRatio = g.initDist > 0 ? currentDist / g.initDist : 1;
      const newScale = clampScale(g.initScale * distRatio);
      const angleDiff = currentAngle - g.initAngle;
      const newRotation = normalizeRotation(g.initRotation + angleDiff);

      // Center of two fingers → token position
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const parentCoords = toParentCoords(center.x, center.y);

      onMove(id, parentCoords.x, parentCoords.y);
      onRotate(id, newRotation);
      if (onScale) onScale(id, Math.round(newScale * 1000) / 1000);

    } else {
      // ── One-finger drag ──────────────────────────────────────────────────
      if (g.mode === 'transform') return; // wait until finger count drops before switching back

      const dx = e.clientX - g.startClientX;
      const dy = e.clientY - g.startClientY;
      const parentBase = toParentCoords(g.startClientX, g.startClientY);
      const parentNew  = toParentCoords(e.clientX, e.clientY);

      void dx; void dy; // used implicitly via parentNew - parentBase shift
      const newX = g.startTokenX + (parentNew.x - parentBase.x);
      const newY = g.startTokenY + (parentNew.y - parentBase.y);

      onMove(id, newX, newY);
    }
  }, [id, onMove, onRotate, onScale]);

  // ── Pointer up / cancel ─────────────────────────────────────────────────────
  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();

    pointers.current.delete(e.pointerId);
    const pts = Array.from(pointers.current.values());

    if (pts.length === 0) {
      // All fingers lifted
      const g = gesture.current;
      setIsActive(false);

      if (g) {
        // Tap detection
        const dist = Math.hypot(e.clientX - g.downClientX, e.clientY - g.downClientY);
        const dur  = Date.now() - g.downTime;

        if (g.mode === 'drag' && dist < 8 && dur < 300) {
          onSelect(isSelected ? null : id);
        } else {
          const coords = toParentCoords(e.clientX, e.clientY);
          onRelease(id, coords.x, coords.y);
        }
      }

      gesture.current = null;

    } else if (pts.length === 1) {
      // One finger remains — switch back to drag from current token position
      const [remaining] = Array.from(pointers.current.entries());
      const [, pt] = remaining;
      startDrag(pt.x, pt.y);
      // Update drag baseline to current token position (already moved by transform)
      if (gesture.current) {
        gesture.current.startTokenX = x;
        gesture.current.startTokenY = y;
      }
    } else {
      // Still 2+ fingers — re-baseline transform
      startTransform(pts);
    }
  }, [id, isSelected, onSelect, onRelease, x, y, scale, rotation]);

  // Mouse fallback (desktop)
  const handleMouseDown = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startTX = x;
    const startTY = y;
    const downTime = Date.now();

    const onMove_ = (mv: MouseEvent) => {
      const parentBase = toParentCoords(startX, startY);
      const parentNew  = toParentCoords(mv.clientX, mv.clientY);
      onMove(id, startTX + (parentNew.x - parentBase.x), startTY + (parentNew.y - parentBase.y));
    };

    const onUp_ = (up: MouseEvent) => {
      document.removeEventListener('mousemove', onMove_);
      document.removeEventListener('mouseup', onUp_);

      const dist = Math.hypot(up.clientX - startX, up.clientY - startY);
      const dur  = Date.now() - downTime;

      if (dist < 5 && dur < 250) {
        onSelect(isSelected ? null : id);
      } else {
        const coords = toParentCoords(up.clientX, up.clientY);
        onRelease(id, coords.x, coords.y);
      }
    };

    document.addEventListener('mousemove', onMove_);
    document.addEventListener('mouseup', onUp_);
  };

  // Normal / Selected token layout
  const diameter = isSelected ? 112 : 96;

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => { if (!isDimmed) setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
      className="select-none touch-none token-container"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${
          scale *
          (isActive ? 1.07 : (isHovered && !isDimmed) ? 1.02 : 1) *
          (isDimmed ? 0.9 : 1)
        })`,
        cursor: isDimmed ? 'pointer' : isActive ? 'grabbing' : 'grab',
        transition: isActive
          ? 'box-shadow 0.15s ease-out, opacity 0.3s ease-out'
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
        zIndex: isActive ? 1000 : isSelected ? 900 : isHovered ? 100 : 10,
        opacity: isDimmed ? 0.2 : 1,
        // Active-touch lift shadow on the container
        filter: isActive
          ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.22)) drop-shadow(0 2px 6px rgba(0,0,0,0.14))'
          : isHovered && !isDimmed
            ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))'
            : 'none',
        willChange: isActive ? 'transform' : 'auto',
      }}
    >
      {/* Expanding ripples under token on spawn */}
      {justCreated && (
        <>
          <div
            className="rounded-full border border-zinc-500 pointer-events-none animate-token-ripple-1"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: -1,
            }}
          />
          <div
            className="rounded-full border border-zinc-500 pointer-events-none animate-token-ripple-2"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: -1,
            }}
          />
        </>
      )}

      {/* Inner wrapper for entry scale animation */}
      <div className={justCreated ? "animate-token-spawn" : ""} style={{ transformOrigin: 'center' }}>

      {/* Central Circle Orb */}
      <div
        className={`rounded-full flex flex-col items-center justify-center text-center p-2 border-2 ${
          isYellowSuggested
            ? 'bg-zinc-50 border-dashed border-zinc-600'
            : isSelected
              ? 'bg-zinc-300 border-zinc-950 text-zinc-950 font-black'
              : isConnected
                ? 'bg-zinc-100 border-zinc-700'
                : 'bg-white border-zinc-400 hover:border-zinc-600'
        }`}
        style={{
          width: `${diameter}px`,
          height: `${diameter}px`,
          position: 'relative',
          // Subtle inner ring when actively touched
          boxShadow: isActive
            ? 'inset 0 0 0 2px rgba(0,0,0,0.08), 0 0 0 3px rgba(9,9,11,0.06)'
            : undefined,
          transition: 'box-shadow 0.15s ease-out',
        }}
      >
        {status === "needs_classification" && (
          <span className="absolute top-1 right-2 text-amber-500 text-xs" title="Classificatie mislukt">⚠️</span>
        )}

        {status === "pending_classification" ? (
          <div className="flex flex-col items-center justify-center gap-1.5">
            <svg className="animate-spin h-5 w-5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-[8px] font-medium text-zinc-500 uppercase tracking-widest animate-pulse">
              Analyseren
            </span>
          </div>
        ) : (
          <>
            {drawingDataUrl && showDrawingThumbnail && (
              <img
                src={drawingDataUrl}
                alt=""
                className="w-14 h-10 object-contain mb-1 pointer-events-none"
                draggable={false}
              />
            )}
            <span className="text-[10px] font-bold leading-tight select-none tracking-wide text-zinc-950 line-clamp-3">
              {label}
            </span>
          </>
        )}
      </div>


      </div>

    </div>
  );
}
