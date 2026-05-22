interface DashboardProps {
  onSelectApp: (appId: string) => void;
}

export function Dashboard({ onSelectApp }: DashboardProps) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-auto">
      <div className="max-w-7xl mx-auto p-8 pt-20">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-3">Application Hub</h1>
          <p className="text-slate-400 text-lg">Select an application to begin</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Idea Ecosystem App - Active */}
          <button
            onClick={() => onSelectApp('idea-ecosystem')}
            className="group relative bg-gradient-to-br from-emerald-900/40 to-green-900/40 backdrop-blur-sm rounded-2xl p-8 border border-emerald-600/30 hover:border-emerald-500/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20 text-left"
          >
            <div className="absolute top-4 right-4">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/30">
                ACTIVE
              </span>
            </div>

            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-3xl">🌱</span>
            </div>

            <h3 className="text-2xl font-bold text-emerald-100 mb-2 group-hover:text-emerald-50 transition-colors">
              Idea Ecosystem
            </h3>
            <p className="text-emerald-300/80 text-sm mb-4">
              Cultivate your thoughts. Watch your ideas grow and connect in a living digital garden.
            </p>

            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <span>Launch App</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
          </button>

          {/* Coming Soon Apps */}
          {[
            { icon: '🔮', title: 'App Two', description: 'Future application coming soon' },
            { icon: '⚡', title: 'App Three', description: 'Future application coming soon' },
            { icon: '🎯', title: 'App Four', description: 'Future application coming soon' },
            { icon: '🌊', title: 'App Five', description: 'Future application coming soon' },
            { icon: '🎨', title: 'App Six', description: 'Future application coming soon' },
          ].map((app, index) => (
            <div
              key={index}
              className="relative bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/30 text-left opacity-60 cursor-not-allowed"
            >
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-slate-700/40 text-slate-400 text-xs font-semibold rounded-full border border-slate-600/30">
                  COMING SOON
                </span>
              </div>

              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center mb-6 shadow-lg">
                <span className="text-3xl opacity-50">{app.icon}</span>
              </div>

              <h3 className="text-2xl font-bold text-slate-400 mb-2">
                {app.title}
              </h3>
              <p className="text-slate-500 text-sm mb-4">
                {app.description}
              </p>

              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <span>In Development</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
