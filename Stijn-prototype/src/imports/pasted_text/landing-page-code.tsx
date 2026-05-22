Landing Page - Complete Code Extract
Overview
The Landing page serves as the entry point to the Idea Ecosystem app, offering two methods to enter: scanning an NFC card/tag to resume a saved session, or entering manually. It features a nature-themed design with animated elements and clear visual feedback.

1. Complete Component Code
import { useState } from 'react';

interface LandingProps {
  onEnter: () => void;
}

export function Landing({ onEnter }: LandingProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const handleEnter = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onEnter();
    }, 800);
  };

  const handleNFCScan = () => {
    setIsScanning(true);
    // Simulate NFC scan (in production, this would trigger actual NFC reader)
    setTimeout(() => {
      setIsScanning(false);
      handleEnter();
    }, 1500);
  };

  return (
    <div
      className={`w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 flex items-center justify-center relative overflow-hidden transition-opacity duration-800 ${
        isAnimating ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Animated background pattern */}
      {/* NFC Scanner Circle */}
      {/* Title, Subtitle, Instructions */}
      {/* Feature Cards */}
      {/* Enter Manually Button */}
      {/* Footer Text */}
      {/* Floating Particles */}
      {/* Inline Keyframes */}
    </div>
  );
}
2. State Management
State Variables
const [isAnimating, setIsAnimating] = useState(false);
const [isScanning, setIsScanning] = useState(false);
State Purposes:

State	Type	Purpose
isAnimating	boolean	Controls fade-out animation when leaving landing page
isScanning	boolean	Indicates NFC scanning is in progress
Handler Functions
const handleEnter = () => {
  setIsAnimating(true);
  setTimeout(() => {
    onEnter();
  }, 800);
};
Flow:

Sets isAnimating to true → triggers fade-out (opacity: 1 → 0)
Waits 800ms for animation to complete
Calls onEnter() callback to switch to main app
const handleNFCScan = () => {
  setIsScanning(true);
  // Simulate NFC scan (in production, this would trigger actual NFC reader)
  setTimeout(() => {
    setIsScanning(false);
    handleEnter();
  }, 1500);
};
NFC Scan Flow:

Sets isScanning to true → shows scanning UI
Simulates 1.5s NFC read operation
Sets isScanning to false
Calls handleEnter() to proceed to app
3. Integration with App.tsx
Routing Logic
// In App.tsx
const [currentApp, setCurrentApp] = useState<string | null>(null);
const [hasEntered, setHasEntered] = useState(false);

// Show dashboard first
if (!currentApp) {
  return <Dashboard onSelectApp={(appId) => setCurrentApp(appId)} />;
}

// Show landing page for Idea Ecosystem
if (currentApp === 'idea-ecosystem' && !hasEntered) {
  return <Landing onEnter={() => setHasEntered(true)} />;
}

// Main app (if hasEntered is true)
return <MainApp />;
Navigation Flow:

Dashboard
    ↓ onSelectApp('idea-ecosystem')
    ↓ setCurrentApp('idea-ecosystem')
    ↓
Landing Page (hasEntered = false)
    ↓ onEnter() via NFC scan OR manual entry
    ↓ setHasEntered(true)
    ↓
Main Application
4. Layout Structure
Landing Page Container (full viewport, centered flex)
├── Background Pattern (animated dots)
├── Main Content (centered, max-width 42rem)
│   ├── NFC Scanner Circle
│   │   ├── Icon (NFC or Spinner)
│   │   ├── Pulsing Rings (emerald or yellow)
│   │   └── Hover Tooltip
│   ├── Scanning Status (conditional, when scanning)
│   ├── Title: "Idea Ecosystem"
│   ├── Subtitle: Description
│   ├── Instructions: NFC or manual
│   ├── Feature Cards (3 columns)
│   │   ├── 🌱 Plant Ideas
│   │   ├── 🌿 Watch Them Grow
│   │   └── 🔗 Find Connections
│   ├── "Enter Manually" Button
│   └── Footer Text
└── Floating Particles (20 animated dots)
5. Background Design
Main Background
className={`w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 flex items-center justify-center relative overflow-hidden transition-opacity duration-800 ${
  isAnimating ? 'opacity-0' : 'opacity-100'
}`}
Gradient Colors:

from-emerald-950: #022c22 (darkest emerald)
via-green-950: #052e16 (dark green middle)
to-teal-950: #042f2e (dark teal)
Direction: Bottom-right diagonal (br)
Layout:

flex items-center justify-center: Centers content
relative: Positioning context for absolute children
overflow-hidden: Clips particles at edges
Exit Animation:

transition-opacity duration-800: 800ms fade
opacity-0 when isAnimating is true
opacity-100 by default
Animated Dot Pattern
<div className="absolute inset-0 opacity-10" style={{
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.15) 2px, transparent 2px),
    radial-gradient(circle at 60% 50%, rgba(16, 185, 129, 0.12) 2px, transparent 2px),
    radial-gradient(circle at 40% 70%, rgba(34, 197, 94, 0.1) 2px, transparent 2px)
  `,
  backgroundSize: '48px 48px',
  animation: 'float 20s ease-in-out infinite',
}}></div>
Pattern Details:

Three radial gradients at different positions
Dot size: 2px radius
Colors: Green variants at low opacity (10-15%)
Grid size: 48px × 48px
Overall opacity: 10% (very subtle)
Animation: Uses float keyframe (20s loop)
6. NFC Scanner Circle
Container & Button
<button
  onClick={handleNFCScan}
  className="relative group cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
  disabled={isScanning}
>

Button Properties:

relative: Positioning context for rings
group: Enables group-hover for children
Hover: Scales to 110%
Active (click): Scales to 95%
disabled={isScanning}: Prevents double-clicks during scan
Circle Element
<div className={`w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50 transition-all duration-500 ${
  isScanning ? 'animate-pulse scale-110' : 'group-hover:shadow-emerald-400/70'
}`}>
Styling:

Size: 128px × 128px (8rem)
Shape: Perfect circle (rounded-full)
Background: Emerald to green gradient
Shadow: Extra large with emerald glow
Transition: 500ms for smooth state changes
States:

Scanning: animate-pulse scale-110 (pulsing, enlarged)
Hover: shadow-emerald-400/70 (brighter glow)
Default: Standard shadow
Icons (State-Dependent)
Scanning State (Spinner):

{isScanning ? (
  <svg className="w-20 h-20 text-white animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
Size: 80px (5rem)
Color: White
Animation: Continuous spin
Design: Loading spinner with arc
Idle State (NFC Icon):

) : (
  <svg className="w-20 h-20 text-white group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 9h5v5h-5z" />
  </svg>
)}
Size: 80px (5rem)
Color: White
Hover: Scales to 110%
Design: Phone/card with NFC symbol
Pulsing Rings
Scanning Rings (Yellow):

{isScanning ? (
  <>
    <div className="absolute inset-0 rounded-full border-4 border-yellow-400/50 animate-ping"></div>
    <div className="absolute inset-0 rounded-full border-3 border-yellow-500/40" style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite 0.3s' }}></div>
  </>
Two rings for layered effect
Color: Yellow (warning/active state)
Animation: animate-ping (expand and fade)
Second ring: 0.3s delay for cascading effect
Border width: 4px and 3px
Idle Rings (Emerald):

) : (
  <>
    <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-ping"></div>
    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s' }}></div>
  </>
)}
Two rings for subtle pulsing
Color: Emerald (matches theme)
Animation: Slower ping (2s instead of 1s)
Second ring: 0.5s delay
Border width: 4px and 2px
Hover Tooltip
<div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
  <div className="bg-emerald-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-emerald-600/50 whitespace-nowrap">
    <p className="text-xs text-emerald-200 font-medium">
      {isScanning ? 'Scanning...' : 'Tap to scan NFC card/tag'}
    </p>
  </div>
</div>
Positioning:

absolute -bottom-12: 48px below circle
left-1/2 -translate-x-1/2: Horizontally centered
opacity-0: Hidden by default
group-hover:opacity-100: Visible on button hover
Styling:

Background: Dark emerald at 90% opacity
Backdrop blur: Frosted glass effect
Border: Emerald at 50% opacity
Text: Extra small (12px), emerald-200
No wrap: whitespace-nowrap prevents line breaks
Dynamic Text:

Scanning: "Scanning..."
Idle: "Tap to scan NFC card/tag"
7. Scanning Status Indicator
{isScanning && (
  <div className="mb-4 text-yellow-400 font-semibold text-lg animate-pulse">
    📡 Scanning for NFC tag...
  </div>
)}
Conditional Rendering:

Only shows when isScanning is true
Positioned above title
Styling:

Color: Yellow (matches scanning rings)
Size: 18px (large)
Weight: Semibold (600)
Animation: Pulse (fade in/out)
Icon: 📡 antenna emoji
8. Title & Subtitle Section
Main Title
<h1 className="text-6xl font-bold text-emerald-100 mb-4 tracking-tight">
  Idea Ecosystem
</h1>
Styling:

Size: 60px (3.75rem)
Weight: Bold (700)
Color: emerald-100 (#d1fae5) - light emerald
Letter spacing: Tight (tracking-tight)
Bottom margin: 16px
Subtitle
<p className="text-xl text-emerald-300/90 mb-2 leading-relaxed">
  Cultivate your thoughts. Watch your ideas grow and connect in a living digital garden.
</p>
Styling:

Size: 20px (1.25rem)
Color: emerald-300 at 90% opacity
Line height: Relaxed (1.625)
Bottom margin: 8px
Instructions
<p className="text-sm text-emerald-400/70 mb-8">
  Scan your NFC card above to resume your session, or enter manually below
</p>
Styling:

Size: 14px (0.875rem)
Color: emerald-400 at 70% opacity (muted)
Bottom margin: 32px (creates space before features)
9. Feature Cards
Grid Container
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 text-sm">
Layout:

Mobile: 1 column (stacked)
Tablet+: 3 columns (≥768px)
Gap: 16px between cards
Bottom margin: 48px (before button)
Base text size: 14px
Individual Card Structure
<div className="bg-emerald-900/40 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30 hover:border-emerald-500/50 transition-all duration-300 hover:scale-105">
  <div className="text-3xl mb-2">🌱</div>
  <div className="text-emerald-200 font-semibold mb-1">Plant Ideas</div>
  <div className="text-emerald-400/70 text-xs">Drop and organize your thoughts</div>
</div>
Card Styling:

Background: emerald-900 at 40% opacity
Backdrop blur: Frosted glass effect
Corners: Rounded (8px)
Padding: 16px
Border: Emerald at 30% opacity
Hover border: Brighter emerald at 50%
Hover effect: Scale to 105%
Transition: 300ms on all properties
Content Structure:

Icon: 30px emoji
Title: Semibold, emerald-200
Description: Extra small (12px), emerald-400 at 70%
Three Feature Cards
🌱 Plant Ideas
"Drop and organize your thoughts"
🌿 Watch Them Grow
"Ideas flourish with attention"
🔗 Find Connections
"Discover hidden relationships"
10. Enter Manually Button
<button
  onClick={handleEnter}
  disabled={isScanning}
  className={`group relative px-12 py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-lg font-bold rounded-xl transition-all duration-300 shadow-2xl hover:shadow-emerald-500/50 hover:scale-110 active:scale-100 overflow-hidden ${
    isScanning ? 'opacity-50 cursor-not-allowed' : ''
  }`}
>
  <span className="relative z-10 flex items-center gap-3">
    Enter Manually
    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  </span>

  {/* Shimmer effect */}
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
</button>
Button Styling
Base Styles:

Padding: 48px horizontal, 16px vertical
Background: Emerald to green gradient (horizontal)
Text: White, 18px, bold
Corners: Extra rounded (12px)
Shadow: Extra large with emerald glow
Overflow hidden: Clips shimmer effect
Hover States:

Background: Brighter gradient (500 instead of 600)
Shadow: Stronger emerald glow
Scale: 110% enlargement
Arrow: Slides right 4px
Active State:

Scale: Returns to 100% (button press feedback)
Disabled State (when scanning):

Opacity: 50% (grayed out)
Cursor: cursor-not-allowed
Button Content
Text & Icon:

<span className="relative z-10 flex items-center gap-3">
  Enter Manually
  <svg>...</svg>
</span>
z-10: Above shimmer effect
flex gap-3: Icon 12px from text
Arrow icon scales with hover
Shimmer Effect
<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
How it works:

Gradient: transparent → white 20% → transparent
Initial position: Off-screen left (translate-x-[-100%])
Hover trigger: Slides across to off-screen right (translate-x-[100%])
Duration: 700ms (slower than other animations)
Creates "shine" effect sweeping across button
11. Footer Text
<p className="mt-8 text-emerald-400/50 text-sm">
  No login required • Your ideas stay private • NFC cards load saved sessions
</p>
Styling:

Top margin: 32px (space from button)
Color: emerald-400 at 50% opacity (very muted)
Size: 14px
Separator: Bullet points (•)
Message Points:

No login required
Your ideas stay private
NFC cards load saved sessions
12. Floating Particles
<div className="absolute inset-0 pointer-events-none">
  {[...Array(20)].map((_, i) => (
    <div
      key={i}
      className="absolute w-2 h-2 bg-emerald-400/20 rounded-full"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
        animationDelay: `${Math.random() * 5}s`,
      }}
    ></div>
  ))}
</div>
Particle System
Container:

absolute inset-0: Covers entire viewport
pointer-events-none: Doesn't interfere with clicks
Particle Count: 20 particles

Particle Styling:

Size: 8px × 8px (0.5rem)
Shape: Circle (rounded-full)
Color: emerald-400 at 20% opacity
Random Positioning:

left: 0-100% (random across width)
top: 0-100% (random across height)
Animation Randomization:

Duration: 5-15 seconds (varies per particle)
Delay: 0-5 seconds (staggered start)
Animation: Uses float keyframe
13. Inline Keyframe Animation
<style>{`
  @keyframes float {
    0%, 100% {
      transform: translateY(0) translateX(0);
    }
    50% {
      transform: translateY(-20px) translateX(10px);
    }
  }
`}</style>
Float Animation
Keyframes:

0% & 100%: Original position
50%: Moved up 20px, right 10px
Effect: Gentle floating motion

Creates wave-like movement
Eases in and out (smooth)
Loops infinitely
Used by:

Background dot pattern (20s duration)
Floating particles (5-15s duration, varies)
14. Color Palette
Background Colors
// Main gradient
const BG_START = "emerald-950";      // #022c22
const BG_MIDDLE = "green-950";       // #052e16
const BG_END = "teal-950";           // #042f2e

// Pattern dots
const DOT_COLOR_1 = "rgba(34, 197, 94, 0.15)";   // green-500 at 15%
const DOT_COLOR_2 = "rgba(16, 185, 129, 0.12)";  // emerald-500 at 12%
const DOT_COLOR_3 = "rgba(34, 197, 94, 0.1)";    // green-500 at 10%
NFC Circle Colors
// Circle background
const CIRCLE_START = "emerald-500";   // #10b981
const CIRCLE_END = "green-600";       // #16a34a

// Idle rings
const RING_IDLE_1 = "emerald-400/30"; // #34d399 at 30%
const RING_IDLE_2 = "emerald-500/20"; // #10b981 at 20%

// Scanning rings
const RING_SCAN_1 = "yellow-400/50";  // #fbbf24 at 50%
const RING_SCAN_2 = "yellow-500/40";  // #eab308 at 40%

// Shadow
const SHADOW_DEFAULT = "emerald-500/50";  // #10b981 at 50%
const SHADOW_HOVER = "emerald-400/70";    // #34d399 at 70%
Text Colors
const TITLE = "emerald-100";          // #d1fae5
const SUBTITLE = "emerald-300/90";    // #6ee7b7 at 90%
const INSTRUCTION = "emerald-400/70"; // #34d399 at 70%
const SCANNING_TEXT = "yellow-400";   // #fbbf24
const FOOTER = "emerald-400/50";      // #34d399 at 50%
Feature Card Colors
const CARD_BG = "emerald-900/40";         // #064e3b at 40%
const CARD_BORDER = "emerald-600/30";     // #059669 at 30%
const CARD_BORDER_HOVER = "emerald-500/50"; // #10b981 at 50%
const CARD_TITLE = "emerald-200";         // #a7f3d0
const CARD_DESC = "emerald-400/70";       // #34d399 at 70%
Button Colors
// Background gradient
const BTN_BG_START = "emerald-600";       // #059669
const BTN_BG_END = "green-600";           // #16a34a
const BTN_BG_HOVER_START = "emerald-500"; // #10b981
const BTN_BG_HOVER_END = "green-500";     // #22c55e

// Text & Shadow
const BTN_TEXT = "white";                 // #ffffff
const BTN_SHADOW_HOVER = "emerald-500/50"; // #10b981 at 50%

// Shimmer
const SHIMMER = "white/20";               // #ffffff at 20%
Particle Color
const PARTICLE = "emerald-400/20";        // #34d399 at 20%
15. Animation Timings
Element	Animation	Duration	Easing
Page fade-out	Opacity transition	800ms	Default
NFC circle hover	Scale	300ms	Default
NFC circle active	Scale	Instant	Default
Circle state change	All properties	500ms	Default
Pulsing rings (idle)	Ping	2s	Cubic-bezier
Pulsing rings (scan)	Ping	1s	Cubic-bezier
Scanning status	Pulse	Default	Default
Feature card hover	Scale + border	300ms	Default
Button hover	Scale + shadow	300ms	Default
Arrow slide	Transform	300ms	Default
Shimmer sweep	Transform	700ms	Default
Hover tooltip	Opacity	300ms	Default
Background pattern	Float	20s	Ease-in-out
Floating particles	Float	5-15s (random)	Ease-in-out
16. Responsive Behavior
Breakpoint Adjustments
Mobile (< 768px):

grid-cols-1              /* Feature cards stack vertically */
max-w-2xl px-8           /* Content container maintains padding */
Tablet+ (≥ 768px):

md:grid-cols-3           /* Feature cards in 3 columns */
Content Container:

max-w-2xl                /* Max width 672px (42rem) */
px-8                     /* 32px horizontal padding */
Prevents content from becoming too wide
Maintains readability on all screen sizes
17. Accessibility Features
Semantic HTML
<button> elements for interactive components
<h1> for main title (page heading)
Proper button disable states
Visual Feedback
Hover states on all interactive elements
Disabled state clearly communicated (opacity, cursor)
Active states for button presses
Loading indicators during NFC scan
Keyboard Navigation
NFC button is keyboard focusable
Enter manually button is keyboard focusable
Tab order flows logically top to bottom
State Communication
"Scanning..." text when NFC scan in progress
Different icons for idle vs scanning
Tooltip provides context on hover
18. NFC Simulation Logic
Production vs Development
Current (Development):

const handleNFCScan = () => {
  setIsScanning(true);
  // Simulate NFC scan (in production, this would trigger actual NFC reader)
  setTimeout(() => {
    setIsScanning(false);
    handleEnter();
  }, 1500);
};
Uses setTimeout to simulate 1.5s scan
Always succeeds
Production Implementation:

const handleNFCScan = async () => {
  setIsScanning(true);
  try {
    // Use Web NFC API (Chrome Android)
    const ndef = new NDEFReader();
    await ndef.scan();
    
    ndef.addEventListener("reading", ({ message, serialNumber }) => {
      // Read session ID from NFC tag
      const sessionId = message.records[0].data;
      // Load saved session from database
      await loadSession(sessionId);
      setIsScanning(false);
      handleEnter();
    });
  } catch (error) {
    setIsScanning(false);
    // Show error message
  }
};
19. Complete Props Interface
interface LandingProps {
  onEnter: () => void;
}

// Callback signature
type EnterCallback = () => void;

// Example usage in parent
const handleEnter = () => {
  console.log('User entered app');
  setHasEntered(true);
  // Could add analytics, session initialization, etc.
};

<Landing onEnter={handleEnter} />
20. File Location & Imports
src/
└── app/
    ├── App.tsx              (imports Landing)
    └── components/
        └── Landing.tsx      (component file)
Import in App.tsx:

import { Landing } from './components/Landing';
Dependencies:

React (useState hook)
No external libraries required
Uses Tailwind CSS classes only
21. CSS Requirements
Required in animations.css
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

Main content container entrance animation
Tailwind's Built-in Animations
animate-pulse: For scanning status and circle
animate-ping: For pulsing rings
animate-spin: For loading spinner
This extraction provides everything needed to recreate or understand the Landing Page (NFC Entry Screen) component.