import { useRef, useState, useEffect, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react';

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
}: TokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [justCreated, setJustCreated] = useState(true);


  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);

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



  const handleTouchStart = (e: ReactTouchEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      dragStartPos.current = { x: touch.clientX, y: touch.clientY };
      dragStartTime.current = Date.now();
      setIsDragging(true);

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length > 1) return;
        const parent = ref.current?.parentElement;
        if (!parent) return;

        const parentRect = parent.getBoundingClientRect();
        const touchPoint = moveEvent.touches[0];
        const newX = touchPoint.clientX - parentRect.left;
        const newY = touchPoint.clientY - parentRect.top;

        onMove(id, newX, newY);
      };

      const handleTouchEnd = (endEvent: TouchEvent) => {
        setIsDragging(false);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);

        const touch = endEvent.changedTouches[0];
        if (touch) {
          const distance = Math.sqrt(
            Math.pow(touch.clientX - dragStartPos.current.x, 2) +
            Math.pow(touch.clientY - dragStartPos.current.y, 2)
          );
          const duration = Date.now() - dragStartTime.current;

          if (distance < 5 && duration < 250) {
            onSelect(isSelected ? null : id);
          } else {
            const parent = ref.current?.parentElement;
            if (parent) {
              const parentRect = parent.getBoundingClientRect();
              onRelease(id, touch.clientX - parentRect.left, touch.clientY - parentRect.top);
            }
          }
        }
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(id);

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      const initialDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const initialAngle = Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX) * (180 / Math.PI);
      const startScale = scale;
      const startRotation = rotation;

      const handleTouchMoveTwo = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length !== 2) return;
        moveEvent.preventDefault();

        const t1 = moveEvent.touches[0];
        const t2 = moveEvent.touches[1];

        // 1. Scale
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const distRatio = initialDist > 0 ? currentDist / initialDist : 1;
        const nextScale = Math.min(Math.max(startScale * distRatio, 0.5), 2.5);
        if (onScale) {
          onScale(id, Math.round(nextScale * 100) / 100);
        }

        // 2. Rotate
        const currentAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
        const angleDiff = currentAngle - initialAngle;
        const nextRotation = normalizeRotation(startRotation + angleDiff);
        onRotate(id, nextRotation);

        // 3. Position midpoint drag
        const parent = ref.current?.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const midX = (t1.clientX + t2.clientX) / 2 - parentRect.left;
          const midY = (t1.clientY + t2.clientY) / 2 - parentRect.top;
          onMove(id, midX, midY);
        }
      };

      const handleTouchEndTwo = () => {
        document.removeEventListener('touchmove', handleTouchMoveTwo);
        document.removeEventListener('touchend', handleTouchEndTwo);

        const parent = ref.current?.parentElement;
        if (parent && ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          onRelease(id, (rect.left + rect.width / 2) - parentRect.left, (rect.top + rect.height / 2) - parentRect.top);
        }
      };

      document.addEventListener('touchmove', handleTouchMoveTwo, { passive: false });
      document.addEventListener('touchend', handleTouchEndTwo);
    }
  };

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
        transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
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
        }}
      >
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
      </div>

      {/* Selected detail preview */}
      {isSelected && !isDimmed && (drawingDataUrl || description) && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 w-56 bg-white dark:bg-zinc-900 border border-zinc-500 rounded p-2 pointer-events-none"
          style={{
            top: `${diameter + 8}px`,
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
          {description && (
            <p className="text-[10px] text-zinc-800 dark:text-zinc-100 text-center leading-normal font-medium">
              {description}
            </p>
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
