import { useState, useEffect } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export function IdeaGarden() {
  const { tokens, updateTokenText, updateTokenDescription, deleteToken, deleteAllTokens, addToken, loading, backendConnected } = useTokens();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Log when tokens change to verify synchronization
  useEffect(() => {
    console.log('[IdeaGarden] Tokens updated, count:', tokens.length);
  }, [tokens]);
  const [editValue, setEditValue] = useState('');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');
  const [detailedViewId, setDetailedViewId] = useState<string | null>(null);
  const [detailedNotes, setDetailedNotes] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaNotes, setNewIdeaNotes] = useState('');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950">
        <div className="text-emerald-100 text-lg">Loading...</div>
      </div>
    );
  }

  const startEdit = (token: typeof tokens[0]) => {
    setEditingId(token.id);
    setEditValue(token.description || '');
  };

  const saveEdit = async (id: string) => {
    await updateTokenDescription(id, editValue);
    setEditingId(null);
  };

  const startLabelEdit = (token: typeof tokens[0]) => {
    setEditingLabelId(token.id);
    setLabelValue(token.text);
  };

  const saveLabelEdit = async (id: string) => {
    if (labelValue.trim()) {
      await updateTokenText(id, labelValue.trim());
    }
    setEditingLabelId(null);
  };

  const openDetailedView = (token: typeof tokens[0]) => {
    setDetailedViewId(token.id);
    setDetailedNotes(token.description || '');
  };

  const saveDetailedView = async () => {
    if (detailedViewId) {
      await updateTokenDescription(detailedViewId, detailedNotes);
      setDetailedViewId(null);
    }
  };

  const openNewIdeaModal = () => {
    setIsCreatingNew(true);
    setNewIdeaTitle('');
    setNewIdeaNotes('');
  };

  const saveNewIdea = async () => {
    if (newIdeaTitle.trim()) {
      await addToken(
        newIdeaTitle.trim(),
        {
          x: 300 + Math.random() * 400,
          y: 200 + Math.random() * 300
        },
        newIdeaNotes.trim()
      );
      setIsCreatingNew(false);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 overflow-auto animate-fadeIn">
      <div className="max-w-6xl mx-auto p-8 pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-emerald-100 mb-2">🌱 Idea Garden</h2>
            <p className="text-emerald-300/80">Cultivate and refine your ideas. Add descriptions to help identify themes and connections.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                if (window.confirm(`Delete all ${tokens.length} ideas? This cannot be undone.`)) {
                  deleteAllTokens();
                }
              }}
              variant="outline"
              className="bg-red-900/80 hover:bg-red-800 text-red-200 border-red-600/50 hover:border-red-500 shadow-lg hover:shadow-red-500/30 hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </Button>
            <Button
              onClick={openNewIdeaModal}
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Idea
            </Button>
            {backendConnected && (
              <Badge variant="default" className="bg-emerald-900/80 border-emerald-700/50 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Screen 3 - Live
              </Badge>
            )}
          </div>
        </div>

        {/* NFC Scanning Integration */}
        <Card className="mb-8 bg-gradient-to-r from-emerald-900/60 to-teal-900/60 backdrop-blur-sm border-emerald-600/30 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02]">
          <CardContent className="p-6">
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
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Launch Scanner
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((token, index) => (
            <Card
              key={token.id}
              className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:border-emerald-500/50 cursor-pointer"
              style={{
                animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-sm text-white font-bold shadow-lg">
                    {token.text.charAt(0).toUpperCase()}
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
                      className="flex items-center gap-2 cursor-pointer group flex-1"
                      onClick={() => startLabelEdit(token)}
                    >
                      <h3 className="text-lg font-bold text-emerald-100 group-hover:text-emerald-300 transition-colors truncate">
                        {token.text}
                      </h3>
                      <svg
                        className="w-4 h-4 text-emerald-400/60 group-hover:text-emerald-300 transition-all duration-300 group-hover:scale-110 flex-shrink-0"
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
                      <Button
                        onClick={() => saveEdit(token.id)}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="outline"
                        className="bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 border-emerald-700 hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-emerald-300/90 mb-4 min-h-[60px]">
                      {token.description || <span className="italic text-emerald-400/50">No description yet. Click edit to add one.</span>}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openDetailedView(token)}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white hover:scale-105 active:scale-95 hover:shadow-lg transition-all duration-300"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        View Details
                      </Button>
                      <Button
                        onClick={() => {
                          if (window.confirm(`Delete "${token.text}"?`)) {
                            deleteToken(token.id);
                          }
                        }}
                        variant="outline"
                        className="bg-red-900/50 hover:bg-red-800/50 text-red-200 border-red-700 hover:scale-105 active:scale-95 hover:shadow-lg transition-all duration-300"
                        title="Delete idea"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {tokens.length === 0 && (
          <div className="text-center py-20">
            <p className="text-emerald-400/60 text-lg">No ideas yet. Add some tokens on the canvas to get started!</p>
          </div>
        )}

        {/* Detailed View Modal */}
        {detailedViewId && (() => {
          const token = tokens.find(t => t.id === detailedViewId);
          if (!token) return null;

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-3xl bg-gradient-to-br from-emerald-900/95 to-green-900/95 backdrop-blur-md border-emerald-500/50 shadow-2xl max-h-[90vh] overflow-auto">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-emerald-100">Detailed Idea View</h2>
                    <button
                      onClick={() => setDetailedViewId(null)}
                      className="w-10 h-10 rounded-full bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-emerald-300 mb-2">Title</label>
                      <div className="text-2xl font-bold text-emerald-100 bg-emerald-950/50 px-4 py-3 rounded-lg border border-emerald-600/30">
                        {token.text}
                      </div>
                    </div>

                    {/* Detailed Notes */}
                    <div>
                      <label className="block text-sm font-medium text-emerald-300 mb-2">Detailed Notes</label>
                      <textarea
                        value={detailedNotes}
                        onChange={(e) => setDetailedNotes(e.target.value)}
                        className="w-full h-64 px-4 py-3 bg-emerald-950/50 text-emerald-100 border border-emerald-600/50 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 resize-none"
                        placeholder="Add detailed notes, thoughts, connections, next steps..."
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={saveDetailedView}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </Button>
                      <Button
                        onClick={() => setDetailedViewId(null)}
                        variant="outline"
                        className="bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 border-emerald-700 hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        {/* New Idea Modal */}
        {isCreatingNew && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl bg-gradient-to-br from-emerald-900/95 to-green-900/95 backdrop-blur-md border-emerald-500/50 shadow-2xl max-h-[90vh] overflow-auto">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-emerald-100">Create New Idea</h2>
                  <button
                    onClick={() => setIsCreatingNew(false)}
                    className="w-10 h-10 rounded-full bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-emerald-300 mb-2">Idea Title *</label>
                    <input
                      type="text"
                      value={newIdeaTitle}
                      onChange={(e) => setNewIdeaTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-emerald-950/50 text-emerald-100 border border-emerald-600/50 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="Enter a title for your idea..."
                      autoFocus
                    />
                  </div>

                  {/* Detailed Notes */}
                  <div>
                    <label className="block text-sm font-medium text-emerald-300 mb-2">Detailed Notes</label>
                    <textarea
                      value={newIdeaNotes}
                      onChange={(e) => setNewIdeaNotes(e.target.value)}
                      className="w-full h-64 px-4 py-3 bg-emerald-950/50 text-emerald-100 border border-emerald-600/50 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 resize-none"
                      placeholder="Add detailed notes, thoughts, connections, next steps..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={saveNewIdea}
                      disabled={!newIdeaTitle.trim()}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Idea
                    </Button>
                    <Button
                      onClick={() => setIsCreatingNew(false)}
                      variant="outline"
                      className="bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 border-emerald-700 hover:scale-105 active:scale-95 transition-all duration-300"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
