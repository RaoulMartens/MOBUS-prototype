Blue Wave Suggestion Animation - Complete Code Extract
Overview
A visual suggestion system that sends traveling water-blue wave ripples from a randomly selected token to the user's cursor position, with a tooltip providing contextual suggestions about the idea.

1. State Management
// State declarations in TokenCanvas component
const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
const [cursorPulse, setCursorPulse] = useState<{ tokenId: string; suggestion: string } | null>(null);
const canvasRef = useRef<HTMLDivElement>(null);
State Structure:

mousePos: Tracks cursor position relative to canvas { x: number, y: number } | null
cursorPulse: Active wave data { tokenId: string, suggestion: string } | null
canvasRef: Reference to canvas div for calculating mouse position
2. Mouse Position Tracking
// Track mouse position
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const canvas = canvasRef.current;
  if (canvas) {
    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }
}, []);
How it works:

Attaches native mousemove listener to canvas div
Converts screen coordinates to canvas-relative coordinates
Updates mousePos state on every mouse movement
Cleans up listener on component unmount
3. Periodic Wave Trigger
// Periodic cursor pulse from random token
useEffect(() => {
  const interval = setInterval(() => {
    if (tokens.length > 0 && mousePos && !cursorPulse) {
      const randomToken = tokens[Math.floor(Math.random() * tokens.length)];
      const suggestions = [
        `Consider expanding on "${randomToken.label}"`,
        `How does "${randomToken.label}" connect to your goals?`,
        `What if you merged "${randomToken.label}" with another idea?`,
        `"${randomToken.label}" could be a key insight`,
        `Explore "${randomToken.label}" from a different angle`,
        `"${randomToken.label}" might unlock new connections`,
      ];
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

      setCursorPulse({ tokenId: randomToken.id, suggestion: randomSuggestion });
    }
  }, 8000);

  return () => clearInterval(interval);
}, [tokens, mousePos, cursorPulse]);
Trigger Logic:

Runs every 8 seconds (8000ms)
Conditions to trigger:
At least one token exists
Mouse is on canvas (mousePos is not null)
No active wave (!cursorPulse - prevents overlapping waves)
Process:
Randomly selects a token
Randomly selects a suggestion from array
Sets cursorPulse state with { tokenId, suggestion }
Dependency array: Re-creates interval when tokens/mousePos/cursorPulse changes
4. SVG Wave Animation
{/* Cursor wave ripple from random token */}
{cursorPulse && mousePos && (() => {
  const token = tokens.find(t => t.id === cursorPulse.tokenId);
  if (!token) return null;

  // Calculate angle from token to cursor
  const angle = Math.atan2(mousePos.y - token.y, mousePos.x - token.x);
  const angleDeg = (angle * 180) / Math.PI;

  const radius = 25;

  return (
    <g key="cursor-wave">
      {/* Traveling semi-circles (half circles) */}
      {[0, 1, 2, 3, 4].map(i => (
        <g key={`traveling-${i}`}>
          <path
            d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius}`}
            fill="none"
            stroke="rgba(34, 211, 238, 0.9)"
            strokeWidth="3"
          >
            <animateMotion
              dur="2.8s"
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
              rotate="auto"
            >
              <mpath href="#wave-path" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;0.9;0.9;0"
              keyTimes="0;0.15;0.75;1"
              dur="2.8s"
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
            />
            <animateTransform
              attributeName="transform"
              type="scale"
              values="0.3;1.5"
              dur="2.8s"
              repeatCount="indefinite"
              begin={`${i * 0.5}s`}
              additive="sum"
            />
          </path>
        </g>
      ))}

      {/* Define the path from token to cursor */}
      <path
        id="wave-path"
        d={`M ${token.x} ${token.y} L ${mousePos.x} ${mousePos.y}`}
        fill="none"
        stroke="none"
      />

      {/* Impact at cursor */}
      <circle
        cx={mousePos.x}
        cy={mousePos.y}
        r="15"
        fill="rgba(103, 232, 249, 0.3)"
        stroke="rgba(34, 211, 238, 0.8)"
        strokeWidth="2"
      >
        <animate
          attributeName="r"
          values="15;25;15"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0.3;0.6"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
})()}
Wave Animation Breakdown:
Semi-Circle Path:

d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius}`}
Creates semi-circle arc from top to bottom
Radius: 25px
Opens horizontally (will rotate to face direction of travel)
Colors:

Stroke: rgba(34, 211, 238, 0.9) - Cyan/water-blue at 90% opacity
Fill: rgba(103, 232, 249, 0.3) - Lighter cyan at 30% opacity (for cursor circle)
Five Staggered Waves:

Array [0, 1, 2, 3, 4] creates 5 wave elements
Each begins 0.5 seconds after the previous (begin={i * 0.5}s)
Creates cascading wave effect
AnimateMotion:

<animateMotion
  dur="2.8s"
  repeatCount="indefinite"
  begin={`${i * 0.5}s`}
  rotate="auto"
>

  <mpath href="#wave-path" />
</animateMotion>
Duration: 2.8 seconds per wave
rotate="auto": Automatically orients semi-circle along path direction (keeps open end facing token)
repeatCount="indefinite": Loops continuously
Follows path from token to cursor
Opacity Animation:

<animate
  attributeName="opacity"
  values="0;0.9;0.9;0"
  keyTimes="0;0.15;0.75;1"
  dur="2.8s"
  repeatCount="indefinite"
  begin={`${i * 0.5}s`}
/>
Fade in: 0 → 0.9 (first 15% of journey)
Stay visible: 0.9 (15% to 75% of journey)
Fade out: 0.9 → 0 (last 25% of journey)
Scale Animation:

<animateTransform
  attributeName="transform"
  type="scale"
  values="0.3;1.5"
  dur="2.8s"
  repeatCount="indefinite"
  begin={`${i * 0.5}s`}
  additive="sum"
/>
Starts small: 0.3x scale at token
Grows large: 1.5x scale at cursor
additive="sum": Combines with rotation transform
Cursor Impact Circle:

Pulsing circle at cursor position
Radius oscillates: 15px ↔ 25px (1s duration)
Opacity oscillates: 0.6 ↔ 0.3 (1s duration)
Provides visual anchor for where wave is traveling to
5. Tooltip Display
{/* Cursor suggestion tooltip */}
{cursorPulse && mousePos && (
  <div
    className="absolute pointer-events-none z-50 animate-fadeIn"
    style={{
      left: `${mousePos.x}px`,
      top: `${mousePos.y - 60}px`,
      transform: 'translateX(-50%)',
    }}
  >
    <div className="bg-gradient-to-br from-cyan-900 to-sky-900 backdrop-blur-md px-4 py-3 rounded-xl border border-cyan-500/50 shadow-2xl shadow-cyan-500/40 max-w-xs">
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 text-cyan-300 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-cyan-100 text-sm font-medium leading-tight">
          {cursorPulse.suggestion}
        </p>
      </div>
    </div>
    {/* Arrow pointing to cursor */}
    <div className="w-3 h-3 bg-cyan-900 border-r border-b border-cyan-500/50 transform rotate-45 mx-auto mt-[-6px]"></div>
  </div>
)}
Tooltip Styling:
Positioning:

left: mousePos.x - Horizontally at cursor
top: mousePos.y - 60px - 60px above cursor
transform: translateX(-50%) - Centers horizontally
Visual Design:

Background: Gradient from cyan-900 to sky-900
Border: border-cyan-500/50 (cyan at 50% opacity)
Backdrop blur: backdrop-blur-md
Shadow: shadow-2xl shadow-cyan-500/40
Max width: max-w-xs (20rem / 320px)
Icon:

Lightbulb icon (suggesting ideas)
Color: text-cyan-300
Size: 20px × 20px
Fixed size with flex-shrink-0
Arrow:

12px × 12px square rotated 45° to create diamond
Positioned with negative margin to overlap card
Creates "pointing arrow" effect toward cursor
Animation:

Uses animate-fadeIn class (defined in animations.css)
6. Clearing Wave on Interaction
const handleMove = (id: string, newX: number, newY: number) => {
  if (!tokens) return;
  setCursorPulse(null); // Clear pulse on interaction
  const updatedTokens = tokens.map((token) => {
    if (token.id === id) {
      return { ...token, x: newX, y: newY, lastInteracted: Date.now() };
    }
    return token;
  });
  onTokensChange(updatedTokens);
};

const addToken = () => {
  setCursorPulse(null); // Clear pulse on interaction
  // ... rest of add token logic
};

const handleScaleChange = (id: string, scale: number) => {
  if (!tokens) return;
  setCursorPulse(null); // Clear pulse on interaction
  // ... rest of scale logic
};

const updateTokenDescription = (id: string, description: string) => {
  if (!tokens) return;
  setCursorPulse(null); // Clear pulse on interaction
  // ... rest of update logic
};

const handleCanvasClick = () => {
  if (cursorPulse) {
    setCursorPulse(null); // Clear pulse on click
  }
};

// Scale mode toggle button
onClick={() => {
  setCursorPulse(null);
  setScaleMode(!scaleMode);
}}
Interactions that clear the wave:

Dragging a token (handleMove)
Adding a new token (addToken)
Scaling a token (handleScaleChange)
Editing token description (updateTokenDescription)
Clicking anywhere on canvas (handleCanvasClick)
Toggling scale mode
Why it clears:

User action indicates active engagement
Prevents visual clutter during interaction
Wave will re-trigger after 8 seconds if conditions met
7. Canvas Ref Setup
<div ref={canvasRef} className="w-full h-full relative" onClick={handleCanvasClick}>
  {/* Connection lines */}
  <svg className="absolute inset-0 w-full h-full pointer-events-none">
    {/* Wave rendering here */}
  </svg>
</div>
Requirements:

Canvas div must have ref={canvasRef} for mouse tracking
SVG must be absolute with inset-0 to cover full canvas
SVG needs pointer-events-none so clicks pass through to canvas div
Canvas div handles onClick={handleCanvasClick} for clearing
8. Required CSS Animation
/* In animations.css */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}
Used for:

Tooltip fade-in when wave appears
Smooth entry of suggestion box
9. Key Parameters Reference
Parameter	Value	Purpose
Trigger interval	8000ms (8s)	How often wave can appear
Wave duration	2.8s	Time for wave to travel from token to cursor
Wave stagger delay	0.5s	Delay between each of the 5 waves
Wave count	5	Number of semi-circles in cascade
Semi-circle radius	25px	Size of each wave element
Scale start	0.3	Initial size at token (30%)
Scale end	1.5	Final size at cursor (150%)
Opacity peak	0.9	Maximum opacity during travel
Stroke color	rgba(34, 211, 238, 0.9)	Cyan/water-blue
Stroke width	3px	Thickness of wave outline
Cursor circle radius	15-25px (pulsing)	Impact indicator size
Tooltip offset	-60px	Distance above cursor
10. Color Palette
// Wave colors (cyan/water-blue theme)
const WAVE_STROKE = "rgba(34, 211, 238, 0.9)";      // Main wave outline
const CURSOR_FILL = "rgba(103, 232, 249, 0.3)";     // Cursor circle fill
const CURSOR_STROKE = "rgba(34, 211, 238, 0.8)";    // Cursor circle outline

// Tooltip colors (Tailwind classes)
const TOOLTIP_BG = "from-cyan-900 to-sky-900";      // Background gradient
const TOOLTIP_BORDER = "border-cyan-500/50";        // Border with opacity
const TOOLTIP_SHADOW = "shadow-cyan-500/40";        // Glow shadow
const TOOLTIP_TEXT = "text-cyan-100";               // Main text
const TOOLTIP_ICON = "text-cyan-300";               // Icon color
11. Usage Example
To implement this system in a new project:

Add state management (mousePos, cursorPulse, canvasRef)
Add mouse tracking effect (mousemove listener)
Add periodic trigger effect (8-second interval)
Render SVG waves when cursorPulse exists
Render tooltip when cursorPulse exists
Clear on interactions (setCursorPulse(null))
Include fadeIn animation in CSS
The system is self-contained and doesn't require external libraries beyond React.