interface Token {
  id: string;
  label: string;
  description: string;
}

interface TokenDetailsPanelProps {
  tokens: Token[];
  isOpen: boolean;
  onToggle: () => void;
}

export function TokenDetailsPanel({ tokens, isOpen, onToggle }: TokenDetailsPanelProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-b from-emerald-900/95 to-green-900/95 backdrop-blur-md border-t border-emerald-700/50 transition-all duration-300 shadow-2xl ${
        isOpen ? 'h-48' : 'h-10'
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-between px-4 h-10 border-b border-emerald-700/50 w-full hover:bg-emerald-800/50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-emerald-100">🌱 Idea Garden</h3>
        <span className="text-emerald-400">
          {isOpen ? '▼' : '▲'}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 overflow-y-auto h-[calc(100%-2.5rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="bg-gradient-to-br from-emerald-800/50 to-green-900/50 backdrop-blur-sm rounded-lg p-3 border border-emerald-600/30 hover:border-emerald-500/50 transition-all shadow-lg"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xs text-white font-medium shadow-md">
                    {token.label}
                  </div>
                  <span className="text-sm font-semibold text-emerald-100">{token.label}</span>
                </div>
                <p className="text-xs text-emerald-300/80">
                  {token.description || 'No description yet'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
