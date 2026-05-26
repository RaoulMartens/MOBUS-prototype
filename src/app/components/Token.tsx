import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';

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
  const [isDragging, setIsDragging] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [justCreated, setJustCreated] = useState(true);


  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);
  const touchInteraction = useRef<{
    mode: 'drag' | 'transform';
    initialDist: number;
    initialAngle: number;
    startScale: number;
    startRotation: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const touchCleanup = useRef<(() => void) | null>(null);

  // Entry animation
  useEffect(() => {
    const timer = setTimeout(() => setJustCreated(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartTime.current = Date.now();
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const parent = ref.current?.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const newX = moveEvent.clientX - parentRect.left;
      const newY = moveEvent.clientY - parentRect.top;

      onMove(id, newX, newY);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Check if it was a click
      const distance = Math.sqrt(
        Math.pow(upEvent.clientX - dragStartPos.current.x, 2) +
        Math.pow(upEvent.clientY - dragStartPos.current.y, 2)
      );
      const duration = Date.now() - dragStartTime.current;

      if (distance < 5 && duration < 250) {
        onSelect(isSelected ? null : id);
      } else {
        const parent = ref.current?.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          onRelease(id, upEvent.clientX - parentRect.left, upEvent.clientY - parentRect.top);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const normalizeRotation = (value: number) => {
    return Math.round((((value % 360) + 360) % 360) * 10) / 10;
  };

  const getTouchCenter = (touches: TouchList) => {
    const t1 = touches[0];
    const t2 = touches[1] || touches[0];
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const t1 = touches[0];
    const t2 = touches[1];
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  };

  const getTouchAngle = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const t1 = touches[0];
    const t2 = touches[1];
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
  };

  const startTransformGesture = (touches: TouchList) => {
    const center = getTouchCenter(touches);
    touchInteraction.current = {
      mode: 'transform',
      initialDist: getTouchDistance(touches),
      initialAngle: getTouchAngle(touches),
      startScale: scale,
      startRotation: rotation,
      lastX: center.x,
      lastY: center.y,
    };
    setIsDragging(false);
    setIsTouching(true);
    onSelect(id);
  };



  const handleTouchStart = (e: ReactTouchEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    e.preventDefault();
    e.stopPropagation();
    setIsTouching(true);

    if (touchInteraction.current) {
      if (e.touches.length >= 2) {
        startTransformGesture(e.touches);
      }
      return;
    }

    if (e.touches.length >= 2) {
      startTransformGesture(e.touches);
    } else {
      const touch = e.touches[0];
      dragStartPos.current = { x: touch.clientX, y: touch.clientY };
      dragStartTime.current = Date.now();
      setIsDragging(true);
      touchInteraction.current = {
        mode: 'drag',
        initialDist: 0,
        initialAngle: 0,
        startScale: scale,
        startRotation: rotation,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };
    }

    const moveTokenToTouchPoint = (clientX: number, clientY: number) => {
      const parent = ref.current?.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      onMove(id, clientX - parentRect.left, clientY - parentRect.top);
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const gesture = touchInteraction.current;
      if (!gesture) return;
      moveEvent.preventDefault();

      if (moveEvent.touches.length >= 2) {
        if (gesture.mode !== 'transform') {
          startTransformGesture(moveEvent.touches);
        }
        const transformGesture = touchInteraction.current;
        if (!transformGesture) return;

        const currentDist = getTouchDistance(moveEvent.touches);
        const distRatio = transformGesture.initialDist > 0 ? currentDist / transformGesture.initialDist : 1;
        const nextScale = Math.min(Math.max(transformGesture.startScale * distRatio, 0.5), 2.5);
        if (onScale) {
          onScale(id, Math.round(nextScale * 100) / 100);
        }

        const currentAngle = getTouchAngle(moveEvent.touches);
        const angleDiff = currentAngle - transformGesture.initialAngle;
        const nextRotation = normalizeRotation(transformGesture.startRotation + angleDiff);
        onRotate(id, nextRotation);

        const center = getTouchCenter(moveEvent.touches);
        transformGesture.lastX = center.x;
        transformGesture.lastY = center.y;
        moveTokenToTouchPoint(center.x, center.y);
        return;
      }

      const touchPoint = moveEvent.touches[0];
      if (!touchPoint) return;

      gesture.lastX = touchPoint.clientX;
      gesture.lastY = touchPoint.clientY;
      moveTokenToTouchPoint(touchPoint.clientX, touchPoint.clientY);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
      const gesture = touchInteraction.current;
      if (!gesture) return;

      if (endEvent.touches.length > 0) {
        if (endEvent.touches.length >= 2) {
          startTransformGesture(endEvent.touches);
          return;
        }

        const remainingTouch = endEvent.touches[0];
        touchInteraction.current = {
          ...gesture,
          mode: 'drag',
          lastX: remainingTouch.clientX,
          lastY: remainingTouch.clientY,
        };
        setIsDragging(true);
        return;
      }

      setIsDragging(false);
      setIsTouching(false);
      touchCleanup.current?.();
      touchCleanup.current = null;
      touchInteraction.current = null;

      const endX = gesture.lastX;
      const endY = gesture.lastY;
      const distance = Math.hypot(endX - dragStartPos.current.x, endY - dragStartPos.current.y);
      const duration = Date.now() - dragStartTime.current;

      if (gesture.mode === 'drag' && distance < 5 && duration < 250) {
        onSelect(isSelected ? null : id);
      } else {
        moveTokenToTouchPoint(endX, endY);
        const parent = ref.current?.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          onRelease(id, endX - parentRect.left, endY - parentRect.top);
        }
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    touchCleanup.current = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  };

  useEffect(() => {
    return () => {
      touchCleanup.current?.();
    };
  }, []);

  // Normal / Selected token layout
  const diameter = isSelected ? 112 : 96;
  
  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onMouseEnter={() => {
        if (isDimmed) return;
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      className="select-none touch-none token-container"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale * (isDragging ? 1.05 : (isHovered && !isDimmed) ? 1.02 : 1) * (isDimmed ? 0.9 : 1)})`,
        cursor: isDimmed ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        transition: isDragging || isTouching
          ? 'opacity 0.3s ease-out'
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
        zIndex: isDragging ? 1000 : isSelected ? 900 : isHovered ? 100 : 10,
        opacity: isDimmed ? 0.2 : 1,
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
          position: 'relative'
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

      {/* Selected detail preview */}
      {isSelected && !isDimmed && (drawingDataUrl || description || ai_metadata) && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 w-64 bg-white dark:bg-zinc-900 border border-zinc-500 rounded p-3 shadow-lg pointer-events-none"
          style={{
            top: `${diameter + 8}px`,
            zIndex: 1100
          }}
        >
          {drawingDataUrl && (
            <img
              src={drawingDataUrl}
              alt=""
              className="w-full h-28 object-contain bg-zinc-50 border border-zinc-300 rounded-sm mb-2"
              draggable={false}
            />
          )}
          {ai_metadata ? (
            <div className="text-left space-y-2">
              <div className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 border-b pb-1">
                {ai_metadata.title || label}
              </div>
              <p className="text-[9px] text-zinc-750 dark:text-zinc-250 leading-normal font-semibold">
                {ai_metadata.summary}
              </p>
              {ai_metadata.interpretation && (
                <p className="text-[9px] text-zinc-600 dark:text-zinc-350 leading-normal italic">
                  {ai_metadata.interpretation}
                </p>
              )}
              {!ai_metadata.interpretation && description && (
                <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-normal">
                  {description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-300 text-zinc-700">
                  📁 {ai_metadata.category}
                </span>
                <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-300 text-zinc-700">
                  👁️ {ai_metadata.perspective}
                </span>
              </div>
              
              {ai_metadata.tags && ai_metadata.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {ai_metadata.tags.map((t, idx) => (
                    <span key={idx} className="text-[7.5px] font-medium px-1.5 py-0.2 bg-zinc-100 text-zinc-655 rounded-full border border-zinc-200">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            description && (
              <p className="text-[10px] text-zinc-800 dark:text-zinc-100 text-center leading-normal font-medium">
                {description}
              </p>
            )
          )}
        </div>
      )}

      {/* Floating Description capsule below token */}
      {description && !isSelected && (isHovered && !isDimmed) && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 w-48 bg-white dark:bg-zinc-900 border border-zinc-500 rounded p-2 pointer-events-none"
          style={{
            top: `${diameter + 8}px`,
          }}
        >
          <p className="text-[10px] text-zinc-950 dark:text-zinc-50 text-center leading-normal font-medium">
            {description}
          </p>
        </div>
      )}
      </div>

    </div>
  );
}
