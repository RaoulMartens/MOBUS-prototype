import { useRef, useState, useEffect, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';

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

// Shortest signed angle delta — handles ±180° atan2 wrap-around
const shortestDelta = (from: number, to: number): number => {
  let d = to - from;
  while (d >  180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

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
  const divRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [justCreated, setJustCreated] = useState(true);

  // ── Stable refs — always latest, never stale in handlers ─────────────────
  const propsRef = useRef({ id, x, y, scale, rotation, isSelected });
  useEffect(() => { propsRef.current = { id, x, y, scale, rotation, isSelected }; });

  const cbRef = useRef({ onMove, onRotate, onRelease, onSelect, onScale });
  useEffect(() => { cbRef.current = { onMove, onRotate, onRelease, onSelect, onScale }; });

  // ── Pointer tracking ──────────────────────────────────────────────────────
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());

  // ── Gesture state — fully self-contained, no propsRef dependency mid-frame
  //    Transform uses INCREMENTAL tracking per frame to avoid:
  //    1. atan2 ±180° discontinuity (shortestDelta fixes that)
  //    2. Stale propsRef between React renders
  const gst = useRef<{
    mode: 'drag' | 'transform';

    // drag: absolute baseline (set once at start)
    startClientX: number;
    startClientY: number;
    startTokenX: number;
    startTokenY: number;

    // transform: incremental — updated every frame
    prevAngle: number;    // angle between fingers, last frame
    prevDist: number;     // distance between fingers, last frame
    prevRotation: number; // token rotation as of last frame (avoids stale propsRef)
    prevScale: number;    // token scale as of last frame (avoids stale propsRef)

    // tap detection
    downTime: number;
    downClientX: number;
    downClientY: number;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setJustCreated(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // ── Pure helpers ──────────────────────────────────────────────────────────
  const fingerDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y);

  const fingerAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const toCanvas = (clientX: number, clientY: number) => {
    const parent = divRef.current?.parentElement;
    if (!parent) return { x: clientX, y: clientY };
    const r = parent.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const normRot = (v: number) => (((v % 360) + 360) % 360);

  const pairList = () => Array.from(ptrs.current.values());

  // ── Baseline setters ──────────────────────────────────────────────────────
  const startDrag = (clientX: number, clientY: number, isFirstTouch: boolean) => {
    const p = propsRef.current;
    gst.current = {
      mode: 'drag',
      startClientX: clientX,
      startClientY: clientY,
      startTokenX: p.x,
      startTokenY: p.y,
      prevAngle: 0, prevDist: 0,
      prevRotation: p.rotation, prevScale: p.scale,
      downTime: isFirstTouch ? Date.now() : (gst.current?.downTime ?? Date.now()),
      downClientX: isFirstTouch ? clientX : (gst.current?.downClientX ?? clientX),
      downClientY: isFirstTouch ? clientY : (gst.current?.downClientY ?? clientY),
    };
  };

  const startTransform = (pts: { x: number; y: number }[]) => {
    const [a, b] = pts;
    const p = propsRef.current;
    gst.current = {
      mode: 'transform',
      startClientX: 0, startClientY: 0,
      startTokenX: p.x, startTokenY: p.y,
      // incremental baseline — current frame is the reference
      prevAngle: fingerAngle(a, b),
      prevDist: fingerDist(a, b),
      prevRotation: p.rotation,
      prevScale: p.scale,
      downTime: gst.current?.downTime ?? Date.now(),
      downClientX: gst.current?.downClientX ?? (a.x + b.x) / 2,
      downClientY: gst.current?.downClientY ?? (a.y + b.y) / 2,
    };
  };

  // Re-baseline transform but keep the ALREADY-COMPUTED rotation/scale
  // (used when fingers shift without a clean lift — avoids reset)
  const rebaseTransform = (pts: { x: number; y: number }[]) => {
    const [a, b] = pts;
    const g = gst.current;
    gst.current = {
      mode: 'transform',
      startClientX: 0, startClientY: 0,
      startTokenX: propsRef.current.x, startTokenY: propsRef.current.y,
      prevAngle: fingerAngle(a, b),
      prevDist: fingerDist(a, b),
      // carry forward what we've already accumulated
      prevRotation: g?.prevRotation ?? propsRef.current.rotation,
      prevScale: g?.prevScale ?? propsRef.current.scale,
      downTime: g?.downTime ?? Date.now(),
      downClientX: g?.downClientX ?? (a.x + b.x) / 2,
      downClientY: g?.downClientY ?? (a.y + b.y) / 2,
    };
  };

  // ── Pointer down ──────────────────────────────────────────────────────────
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setIsActive(true);
    cbRef.current.onSelect(propsRef.current.id);

    const pts = pairList();
    if (pts.length >= 2) {
      // 2nd (or more) finger — switch to transform, carry accumulated values
      rebaseTransform(pts);
    } else {
      // 1st finger
      startDrag(e.clientX, e.clientY, true);
    }
  };

  // ── Pointer move ──────────────────────────────────────────────────────────
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!ptrs.current.has(e.pointerId)) return;
    e.preventDefault();

    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gst.current;
    if (!g) return;

    const pts = pairList();

    if (pts.length >= 2) {
      // ── Two-finger: rotate + scale + translate ─────────────────────────
      if (g.mode !== 'transform') {
        rebaseTransform(pts);
        return; // next event will have stable baseline
      }

      const [a, b] = pts;
      const curAngle = fingerAngle(a, b);
      const curDist  = fingerDist(a, b);

      // Incremental deltas — angle uses shortestDelta to handle ±180° wrap
      const angleDelta  = shortestDelta(g.prevAngle, curAngle);
      const scaleRatio  = g.prevDist > 0 ? curDist / g.prevDist : 1;

      const newRotation = normRot(g.prevRotation + angleDelta);
      const newScale    = clampScale(g.prevScale * scaleRatio);

      // Update per-frame state (carry forward for next event)
      g.prevAngle    = curAngle;
      g.prevDist     = curDist;
      g.prevRotation = newRotation;
      g.prevScale    = newScale;

      const center = toCanvas((a.x + b.x) / 2, (a.y + b.y) / 2);

      const cb = cbRef.current;
      const tid = propsRef.current.id;
      cb.onMove(tid, center.x, center.y);
      cb.onRotate(tid, Math.round(newRotation * 10) / 10);
      if (cb.onScale) cb.onScale(tid, Math.round(newScale * 1000) / 1000);

    } else {
      // ── One-finger drag ────────────────────────────────────────────────
      if (g.mode === 'transform') return; // mid-transform, skip until rebaselined

      const startCanvas = toCanvas(g.startClientX, g.startClientY);
      const curCanvas   = toCanvas(e.clientX, e.clientY);
      const newX = g.startTokenX + (curCanvas.x - startCanvas.x);
      const newY = g.startTokenY + (curCanvas.y - startCanvas.y);

      cbRef.current.onMove(propsRef.current.id, newX, newY);
    }
  };

  // ── Pointer up / cancel ───────────────────────────────────────────────────
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    ptrs.current.delete(e.pointerId);

    const g = gst.current;
    const pts = pairList();

    if (pts.length === 0) {
      // All fingers lifted
      setIsActive(false);

      if (g) {
        const dx  = e.clientX - g.downClientX;
        const dy  = e.clientY - g.downClientY;
        const d   = Math.hypot(dx, dy);
        const dur = Date.now() - g.downTime;
        const tid = propsRef.current.id;

        if (g.mode === 'drag' && d < 8 && dur < 300) {
          cbRef.current.onSelect(propsRef.current.isSelected ? null : tid);
        } else {
          const c = toCanvas(e.clientX, e.clientY);
          cbRef.current.onRelease(tid, c.x, c.y);
        }
      }
      gst.current = null;

    } else if (pts.length === 1) {
      // One finger remains — switch to drag from current token position
      const [pt] = pts;
      const p = propsRef.current;
      gst.current = {
        mode: 'drag',
        startClientX: pt.x,
        startClientY: pt.y,
        startTokenX: p.x,
        startTokenY: p.y,
        prevAngle: 0, prevDist: 0,
        prevRotation: g?.prevRotation ?? p.rotation,
        prevScale: g?.prevScale ?? p.scale,
        downTime: g?.downTime ?? Date.now(),
        downClientX: g?.downClientX ?? pt.x,
        downClientY: g?.downClientY ?? pt.y,
      };
    } else {
      // Still 2+ fingers — re-baseline transform, carry rotation/scale
      rebaseTransform(pts);
    }
  };

  // ── Mouse fallback (desktop) ──────────────────────────────────────────────
  const onMouseDown = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA') return;
    if (e.button !== 0) return;

    const startX  = e.clientX;
    const startY  = e.clientY;
    const startTX = propsRef.current.x;
    const startTY = propsRef.current.y;
    const t0      = Date.now();

    const mv = (ev: MouseEvent) => {
      const sc = toCanvas(startX, startY);
      const nc = toCanvas(ev.clientX, ev.clientY);
      cbRef.current.onMove(propsRef.current.id, startTX + (nc.x - sc.x), startTY + (nc.y - sc.y));
    };
    const up = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      const d   = Math.hypot(ev.clientX - startX, ev.clientY - startY);
      const dur = Date.now() - t0;
      const tid = propsRef.current.id;
      if (d < 5 && dur < 250) {
        cbRef.current.onSelect(propsRef.current.isSelected ? null : tid);
      } else {
        const c = toCanvas(ev.clientX, ev.clientY);
        cbRef.current.onRelease(tid, c.x, c.y);
      }
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  };

  const diameter = isSelected ? 112 : 96;

  return (
    <div
      ref={divRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseDown={onMouseDown}
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
          ? 'filter 0.15s ease-out, opacity 0.3s ease-out'
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
        zIndex: isActive ? 1000 : isSelected ? 900 : isHovered ? 100 : 10,
        opacity: isDimmed ? 0.2 : 1,
        filter: isActive
          ? 'drop-shadow(0 8px 24px rgba(0,0,0,0.22)) drop-shadow(0 2px 6px rgba(0,0,0,0.14))'
          : (isHovered && !isDimmed)
            ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.12))'
            : 'none',
        willChange: isActive ? 'transform' : 'auto',
      }}
    >
      {justCreated && (
        <>
          <div
            className="rounded-full border border-zinc-500 pointer-events-none animate-token-ripple-1"
            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
          />
          <div
            className="rounded-full border border-zinc-500 pointer-events-none animate-token-ripple-2"
            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: -1 }}
          />
        </>
      )}

      <div className={justCreated ? "animate-token-spawn" : ""} style={{ transformOrigin: 'center' }}>
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
