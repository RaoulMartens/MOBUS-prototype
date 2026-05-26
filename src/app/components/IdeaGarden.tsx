import { useState, useEffect } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export function IdeaGarden() {
  const { tokens, updateTokenText, updateTokenDescription, deleteToken, deleteAllTokens, addToken, loading, backendConnected } = useTokens();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "MOBUS - Ideeëntuin";
  }, []);

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
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 overflow-auto">
      <div className="max-w-6xl mx-auto p-8 pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-zinc-950 dark:text-zinc-50 mb-2">Idea Garden</h2>
            <p className="text-zinc-500">Cultivate and refine your ideas. Add descriptions to help identify themes and connections.</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                if (window.confirm(`Delete all ${tokens.length} ideas? This cannot be undone.`)) {
                  deleteAllTokens();
                }
              }}
              variant="outline"
              className="bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-400 font-bold"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </Button>
            <Button
              onClick={openNewIdeaModal}
              className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-950 dark:border-zinc-50 font-bold"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Idea
            </Button>
            {backendConnected && (
              <Badge variant="default" className="bg-zinc-100 border border-zinc-400 text-zinc-900 rounded">
                <div className="w-2 h-2 bg-zinc-950 rounded-full mr-1.5"></div>
                Screen 3 - Live
              </Badge>
            )}
          </div>
        </div>

        {/* NFC Scanning Integration */}
        <Card className="mb-8 bg-white dark:bg-zinc-900 border border-zinc-950 dark:border-zinc-50 rounded shadow-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 border border-zinc-400 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center rounded">
                  <svg className="w-8 h-8 text-zinc-900 dark:text-zinc-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50 mb-1">NFC Idea Scanner</h3>
                  <p className="text-sm text-zinc-500">Scan physical tokens to import ideas into your garden</p>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-50 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 border border-zinc-950 dark:border-zinc-50 font-bold"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Launch Scanner
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((token) => (
            <Card
              key={token.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-350 dark:border-zinc-700 shadow-none rounded cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full border border-zinc-950 dark:border-zinc-50 bg-zinc-100 dark:bg-zinc-850 flex items-center justify-center text-sm text-zinc-950 dark:text-zinc-50 font-bold">
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
                      className="flex-1 px-3 py-1 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-400 rounded focus:outline-none focus:ring-1 focus:ring-zinc-500 font-bold text-lg"
                    />
                  ) : (
                    <div
                      className="flex items-center gap-2 cursor-pointer group flex-1"
                      onClick={() => startLabelEdit(token)}
                    >
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 group-hover:underline truncate">
                        {token.text}
                      </h3>
                      <svg
                        className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-all duration-300 group-hover:scale-110 flex-shrink-0"
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
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-450 dark:border-zinc-750 rounded focus:outline-none focus:border-zinc-950 resize-none"
                      rows={4}
                      placeholder="Describe this idea..."
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveEdit(token.id)}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="outline"
                        className="bg-white hover:bg-zinc-100 border border-zinc-400 text-zinc-800"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 mb-4 min-h-[60px]">
                      {token.description || <span className="italic text-zinc-400/50">No description yet. Click edit to add one.</span>}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openDetailedView(token)}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded"
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
                        className="bg-white hover:bg-zinc-100 border border-zinc-400 text-zinc-800 rounded"
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
            <p className="text-zinc-500 text-lg">No ideas yet. Add some tokens on the canvas to get started!</p>
          </div>
        )}

        {/* Detailed View Modal */}
        {detailedViewId && (() => {
          const token = tokens.find(t => t.id === detailedViewId);
          if (!token) return null;

          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-950 dark:border-zinc-50 shadow-none max-h-[90vh] overflow-auto rounded">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Detailed Idea View</h2>
                    <button
                      onClick={() => setDetailedViewId(null)}
                      className="w-10 h-10 border border-zinc-400 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 flex items-center justify-center rounded"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-bold text-zinc-950 dark:text-zinc-50 mb-2">Title</label>
                      <div className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 rounded border border-zinc-400 dark:border-zinc-750">
                        {token.text}
                      </div>
                    </div>

                    {/* Detailed Notes */}
                    <div>
                      <label className="block text-sm font-bold text-zinc-950 dark:text-zinc-50 mb-2">Detailed Notes</label>
                      <textarea
                        value={detailedNotes}
                        onChange={(e) => setDetailedNotes(e.target.value)}
                        className="w-full h-64 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-400 dark:border-zinc-700 rounded focus:outline-none focus:border-zinc-950 resize-none"
                        placeholder="Add detailed notes, thoughts, connections, next steps..."
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={saveDetailedView}
                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Save Changes
                      </Button>
                      <Button
                        onClick={() => setDetailedViewId(null)}
                        variant="outline"
                        className="bg-white hover:bg-zinc-100 border border-zinc-400 text-zinc-800 rounded"
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
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-950 dark:border-zinc-50 shadow-none max-h-[90vh] overflow-auto rounded">
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">Create New Idea</h2>
                  <button
                    onClick={() => setIsCreatingNew(false)}
                    className="w-10 h-10 border border-zinc-400 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 flex items-center justify-center rounded"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-bold text-zinc-950 dark:text-zinc-50 mb-2">Idea Title *</label>
                    <input
                      type="text"
                      value={newIdeaTitle}
                      onChange={(e) => setNewIdeaTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-400 dark:border-zinc-750 rounded focus:outline-none focus:border-zinc-950"
                      placeholder="Enter a title for your idea..."
                      autoFocus
                    />
                  </div>

                  {/* Detailed Notes */}
                  <div>
                    <label className="block text-sm font-bold text-zinc-950 dark:text-zinc-50 mb-2">Detailed Notes</label>
                    <textarea
                      value={newIdeaNotes}
                      onChange={(e) => setNewIdeaNotes(e.target.value)}
                      className="w-full h-64 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-50 border border-zinc-400 dark:border-zinc-700 rounded focus:outline-none focus:border-zinc-950 resize-none"
                      placeholder="Add detailed notes, thoughts, connections, next steps..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={saveNewIdea}
                      disabled={!newIdeaTitle.trim()}
                      className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Idea
                    </Button>
                    <Button
                      onClick={() => setIsCreatingNew(false)}
                      variant="outline"
                      className="bg-white hover:bg-zinc-100 border border-zinc-400 text-zinc-800 rounded"
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
