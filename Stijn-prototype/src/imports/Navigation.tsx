interface NavigationProps {
  currentView: 'canvas' | 'garden' | 'insights';
  onViewChange: (view: 'canvas' | 'garden' | 'insights') => void;
  onSaveSession: () => void;
}

export function Navigation({ currentView, onViewChange, onSaveSession }: NavigationProps) {
  return (
    <nav className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-emerald-900/95 to-green-900/95 backdrop-blur-md border-b border-emerald-700/50 shadow-2xl z-50">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-emerald-100 mr-6 hover:text-emerald-300 transition-colors duration-300 cursor-default">🌿 Idea Ecosystem</h1>

          <div className="flex gap-2">
          <button
            onClick={() => onViewChange('canvas')}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
              currentView === 'canvas'
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/50 scale-105'
                : 'text-emerald-200 hover:bg-emerald-800/50'
            }`}
          >
            Canvas
          </button>

          <button
            onClick={() => onViewChange('garden')}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
              currentView === 'garden'
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/50 scale-105'
                : 'text-emerald-200 hover:bg-emerald-800/50'
            }`}
          >
            🌱 Idea Garden
          </button>

          <button
            onClick={() => onViewChange('insights')}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
              currentView === 'insights'
                ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/50 scale-105'
                : 'text-emerald-200 hover:bg-emerald-800/50'
            }`}
          >
            🌿 System Insights
          </button>
        </div>
        </div>

        <button
          onClick={onSaveSession}
          className="px-5 py-2 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white rounded-lg transition-all duration-300 font-semibold shadow-lg hover:shadow-yellow-500/50 hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span>Save Session</span>
        </button>
      </div>
    </nav>
  );
}
