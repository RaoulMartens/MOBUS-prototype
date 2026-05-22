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
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.15) 2px, transparent 2px),
          radial-gradient(circle at 60% 50%, rgba(16, 185, 129, 0.12) 2px, transparent 2px),
          radial-gradient(circle at 40% 70%, rgba(34, 197, 94, 0.1) 2px, transparent 2px)
        `,
        backgroundSize: '48px 48px',
        animation: 'float 20s ease-in-out infinite',
      }}></div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-2xl px-8 animate-fadeIn">
        {/* NFC Scanner Circle */}
        <div className="mb-8 flex justify-center">
          <button
            onClick={handleNFCScan}
            className="relative group cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
            disabled={isScanning}
          >
            <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50 transition-all duration-500 ${
              isScanning ? 'animate-pulse scale-110' : 'group-hover:shadow-emerald-400/70'
            }`}>
              {isScanning ? (
                <svg className="w-20 h-20 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-20 h-20 text-white group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.5 9h5v5h-5z" />
                </svg>
              )}
            </div>

            {/* Animated scanning rings */}
            {isScanning ? (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-yellow-400/50 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-3 border-yellow-500/40" style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite 0.3s' }}></div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-emerald-400/30 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s' }}></div>
              </>
            )}

            {/* Hover instruction */}
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-emerald-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-emerald-600/50 whitespace-nowrap">
                <p className="text-xs text-emerald-200 font-medium">
                  {isScanning ? 'Scanning...' : 'Tap to scan NFC card/tag'}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* NFC scanning status */}
        {isScanning && (
          <div className="mb-4 text-yellow-400 font-semibold text-lg animate-pulse">
            📡 Scanning for NFC tag...
          </div>
        )}

        {/* Title */}
        <h1 className="text-6xl font-bold text-emerald-100 mb-4 tracking-tight">
          Idea Ecosystem
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-emerald-300/90 mb-2 leading-relaxed">
          Cultivate your thoughts. Watch your ideas grow and connect in a living digital garden.
        </p>

        {/* NFC instruction */}
        <p className="text-sm text-emerald-400/70 mb-8">
          Scan your NFC card above to resume your session, or enter manually below
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 text-sm">
          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30 hover:border-emerald-500/50 transition-all duration-300 hover:scale-105">
            <div className="text-3xl mb-2">🌱</div>
            <div className="text-emerald-200 font-semibold mb-1">Plant Ideas</div>
            <div className="text-emerald-400/70 text-xs">Drop and organize your thoughts</div>
          </div>

          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30 hover:border-emerald-500/50 transition-all duration-300 hover:scale-105">
            <div className="text-3xl mb-2">🌿</div>
            <div className="text-emerald-200 font-semibold mb-1">Watch Them Grow</div>
            <div className="text-emerald-400/70 text-xs">Ideas flourish with attention</div>
          </div>

          <div className="bg-emerald-900/40 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30 hover:border-emerald-500/50 transition-all duration-300 hover:scale-105">
            <div className="text-3xl mb-2">🔗</div>
            <div className="text-emerald-200 font-semibold mb-1">Find Connections</div>
            <div className="text-emerald-400/70 text-xs">Discover hidden relationships</div>
          </div>
        </div>

        {/* Enter button */}
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

        {/* Footer text */}
        <p className="mt-8 text-emerald-400/50 text-sm">
          No login required • Your ideas stay private • NFC cards load saved sessions
        </p>
      </div>

      {/* Floating particles */}
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
    </div>
  );
}
