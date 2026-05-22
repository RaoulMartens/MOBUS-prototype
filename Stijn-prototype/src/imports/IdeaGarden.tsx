import { useState } from 'react';

interface Token {
  id: string;
  label: string;
  description: string;
}

interface IdeaGardenProps {
  tokens: Token[];
  onUpdateToken: (id: string, description: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onDeleteToken?: (id: string) => void;
}

export function IdeaGarden({ tokens, onUpdateToken, onUpdateLabel, onDeleteToken }: IdeaGardenProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');

  const startEdit = (token: Token) => {
    setEditingId(token.id);
    setEditValue(token.description);
  };

  const saveEdit = (id: string) => {
    onUpdateToken(id, editValue);
    setEditingId(null);
  };

  const startLabelEdit = (token: Token) => {
    setEditingLabelId(token.id);
    setLabelValue(token.label);
  };

  const saveLabelEdit = (id: string) => {
    if (labelValue.trim()) {
      onUpdateLabel(id, labelValue.trim());
    }
    setEditingLabelId(null);
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 overflow-auto pt-16 animate-fadeIn">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-emerald-100 mb-2">🌱 Idea Garden</h2>
          <p className="text-emerald-300/80">Cultivate and refine your ideas. Add descriptions to help identify themes and connections.</p>
        </div>

        {/* NFC Scanning Integration */}
        <div className="mb-8 bg-gradient-to-r from-emerald-900/60 to-teal-900/60 backdrop-blur-sm rounded-xl p-6 border border-emerald-600/30 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-600 to-green-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-100 mb-1">NFC Idea Scanner</h3>
                <p className="text-sm text-emerald-300/80">Scan physical tokens to import ideas into your garden</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg transition-all duration-300 font-medium hover:scale-105 active:scale-95 shadow-lg hover:shadow-emerald-500/50 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Launch Scanner</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((token, index) => (
            <div
              key={token.id}
              className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-xl p-6 border border-emerald-600/30 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:border-emerald-500/50 cursor-pointer"
              style={{
                animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm text-white font-bold shadow-lg">
                  {token.label}
                </div>
                {editingLabelId === token.id ? (
                  <input
                    type="text"
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    onBlur={() => saveLabelEdit(token.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveLabelEdit(token.id);
                      if (e.key === 'Escape') setEditingLabelId(null);
                    }}
                    autoFocus
                    className="flex-1 px-3 py-1 bg-emerald-950/50 text-emerald-100 border border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-bold text-lg"
                  />
                ) : (
                  <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => startLabelEdit(token)}
                  >
                    <h3 className="text-lg font-bold text-emerald-100 group-hover:text-emerald-300 transition-colors">
                      {token.label}
                    </h3>
                    <svg
                      className="w-4 h-4 text-emerald-400/60 group-hover:text-emerald-300 transition-all duration-300 group-hover:scale-110"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              {editingId === token.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-950/50 text-emerald-100 border border-emerald-600/50 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 resize-none"
                    rows={4}
                    placeholder="Describe this idea..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(token.id)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg transition-all duration-300 font-medium hover:scale-105 active:scale-95 shadow-lg hover:shadow-emerald-500/50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-emerald-300/90 mb-4 min-h-[60px]">
                    {token.description || <span className="italic text-emerald-400/50">No description yet. Click edit to add one.</span>}
                  </p>
                  <button
                    onClick={() => startEdit(token)}
                    className="w-full px-4 py-2 bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 rounded-lg transition-all duration-300 font-medium hover:scale-105 active:scale-95 hover:shadow-lg"
                  >
                    Edit Description
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {tokens.length === 0 && (
          <div className="text-center py-20">
            <p className="text-emerald-400/60 text-lg">No ideas yet. Add some tokens on the canvas to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
