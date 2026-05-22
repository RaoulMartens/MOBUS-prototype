import { useRef, useState, useEffect } from 'react';

interface TokenProps {
  id: string;
  x: number;
  y: number;
  label: string;
  description: string;
  isConnected: boolean;
  isPulsing: boolean;
  allTokens: Array<{ id: string; x: number; y: number }>;
  onMove: (id: string, x: number, y: number) => void;
  onDescriptionChange: (id: string, description: string) => void;
  scale?: number;
  onScaleChange?: (id: string, scale: number) => void;
}

export function Token({ id, x, y, label, description, isConnected, isPulsing, allTokens, onMove, onDescriptionChange, scale = 1, onScaleChange }: TokenProps) {
  const ref = useRef<HTMLDivElement>(null);
  const MAX_WORDS = 4;
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(description);
  const [isHovered, setIsHovered] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [showScaleControl, setShowScaleControl] = useState(false);

  // Rotate the text slowly over time
  useEffect(() => {
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.5) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Entry animation
  useEffect(() => {
    setJustCreated(true);
    const timer = setTimeout(() => setJustCreated(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if ((e.target as HTMLElement).closest('.scale-control')) return;
    if (isEditing) return;

    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const parent = ref.current?.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const newX = moveEvent.clientX - parentRect.left;
      const newY = moveEvent.clientY - parentRect.top;

      onMove(id, newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!onScaleChange) return;
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleScaleChange(scale + delta);
  };

  const handleScaleChange = (newScale: number) => {
    if (onScaleChange) {
      onScaleChange(id, Math.max(0.5, Math.min(2, newScale)));
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setEditValue(description);
  };

  const handleSaveEdit = () => {
    const words = editValue.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length <= MAX_WORDS) {
      onDescriptionChange(id, editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(description);
    }
  };

  // Create circular text path
  const displayText = description || 'Double-click to edit';
  const radius = 50; // Radius for the text path
  const textPathId = `textPath-${id}`;

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onMouseEnter={() => {
        setIsHovered(true);
        setShowScaleControl(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowScaleControl(false);
      }}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale * (isDragging ? 1.1 : isHovered ? 1.05 : 1)}) ${justCreated ? 'scale(0)' : ''}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: justCreated ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'transform 0.2s ease-out',
        zIndex: isDragging ? 1000 : isHovered ? 100 : 1,
      }}
    >
      {/* SVG container for token and rotating text */}
      <svg
        width="140"
        height="140"
        viewBox="0 0 140 140"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          overflow: 'visible',
        }}
      >
        <defs>
          <path
            id={textPathId}
            d="M 70,20 A 50,50 0 1,1 69.9,20"
            fill="none"
          />
        </defs>

        {/* Central circle */}
        <g transform="translate(70, 70)">
          {/* Outer glow ring on hover */}
          {isHovered && (
            <circle
              r="38"
              className="fill-none stroke-emerald-400 opacity-30 animate-ping"
              strokeWidth="2"
            />
          )}

          <circle
            r="32"
            className={`transition-all duration-300 ${
              isConnected
                ? 'fill-emerald-500 stroke-emerald-400'
                : 'fill-emerald-700 stroke-emerald-600'
            } ${isPulsing ? 'animate-pulse' : ''}`}
            strokeWidth={isHovered ? "3" : "2"}
            filter="url(#glow)"
          />
          <text
            textAnchor="middle"
            dy="5"
            className={`text-xs fill-white font-medium transition-all duration-200 ${isHovered ? 'text-sm' : ''}`}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </g>

        {/* Rotating circular text */}
        {!isEditing && description && (
          <g transform={`rotate(${rotation}, 70, 70)`}>
            <text
              className="text-[10px] fill-emerald-200 font-medium"
              style={{ letterSpacing: '2px' }}
            >
              <textPath
                href={`#${textPathId}`}
                startOffset="0%"
                textAnchor="start"
              >
                {displayText.toUpperCase()}
              </textPath>
            </text>
          </g>
        )}

        {/* Glow effect filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {isPulsing && (
          <g transform="translate(70, 70)">
            <circle
              r="36"
              className="fill-none stroke-yellow-400 animate-pulse"
              strokeWidth="3"
              opacity="0.7"
            />
          </g>
        )}
      </svg>

      {/* Edit mode input */}
      {isEditing && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Add description (4 words max)"
            className="w-40 px-3 py-2 text-xs text-center bg-emerald-900/95 backdrop-blur-sm text-emerald-100 border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-2xl placeholder-emerald-400/50"
          />
        </div>
      )}

      {/* Scale control - Always visible when hovered */}
      {onScaleChange && (
        <div
          className={`scale-control absolute flex items-center gap-2 bg-emerald-900/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-emerald-600/50 shadow-xl transition-all duration-300 ${
            showScaleControl ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
          style={{
            bottom: '-70px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleScaleChange(scale - 0.1);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            title="Smaller"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <div className="text-xs text-emerald-100 font-bold min-w-[3.5rem] text-center">
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleScaleChange(scale + 0.1);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            title="Larger"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="text-xs text-emerald-300/70 ml-1">scroll</div>
        </div>
      )}
    </div>
  );
}
