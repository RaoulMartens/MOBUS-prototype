import { useState } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Plus, Sparkles, CheckCircle, Edit2, Save, X } from 'lucide-react';
import { Button } from '../../imports/button';
import { Badge } from '../../imports/badge';
import { Card, CardContent } from '../../imports/card';
import { Alert, AlertDescription } from '../../imports/alert';

export function MobileInput() {
  const { tokens, clusters, addToken, addEvent, updateTokenText, updateTokenDescription, loading, backendConnected } = useTokens();
  const [newTokenText, setNewTokenText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState('');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950">
        <div className="text-emerald-100 text-lg">Loading...</div>
      </div>
    );
  }

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTokenText.trim()) {
      await addToken(newTokenText.trim(), {
        x: 300 + Math.random() * 400,
        y: 200 + Math.random() * 300
      });
      setNewTokenText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  const handleGenerateSuggestion = async () => {
    const suggestions = [
      'Consider grouping similar concepts together on the canvas',
      'These ideas might complement each other - try connecting them',
      'Look for patterns and themes across your tokens',
      'Some unclustered ideas may form meaningful groups'
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    await addEvent('suggestion', randomSuggestion);
  };

  const startEdit = (token: typeof tokens[0]) => {
    setEditingId(token.id);
    setEditValue(token.description || '');
  };

  const saveEdit = async (id: string) => {
    if (editValue.trim()) {
      await updateTokenDescription(id, editValue.trim());
    }
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

  return (
    <div className="h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 text-white overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl font-bold text-emerald-100">🌱 Idea Garden</h1>
            {backendConnected && (
              <Badge variant="default" className="bg-emerald-900/80 border-emerald-700/50 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Screen 3 - Live
              </Badge>
            )}
          </div>
          <p className="text-emerald-300/80">Cultivate and refine your ideas</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-100">{tokens.length}</div>
              <div className="text-xs text-emerald-300/80 mt-1">Total Ideas</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-100">{clusters.length}</div>
              <div className="text-xs text-emerald-300/80 mt-1">Clusters</div>
            </CardContent>
          </Card>
        </div>

        {/* Add Token Form */}
        <form onSubmit={handleAddToken} className="space-y-3">
          <textarea
            value={newTokenText}
            onChange={(e) => setNewTokenText(e.target.value)}
            placeholder="Enter your idea..."
            rows={4}
            className="w-full px-4 py-3 bg-emerald-900/40 border border-emerald-600/50 rounded-lg text-emerald-100 placeholder-emerald-400/50 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 resize-none"
          />
          <Button
            type="submit"
            size="lg"
            className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Plus className="w-5 h-5" />
            Add New Idea
          </Button>
        </form>

        {/* Success Message */}
        {showSuccess && (
          <Alert className="bg-gradient-to-r from-green-600 to-emerald-600 border-green-500 shadow-lg animate-fade-in">
            <CheckCircle className="text-white" />
            <AlertDescription className="text-white">
              Idea added successfully! Check the canvas on Screen 2.
            </AlertDescription>
          </Alert>
        )}

        {/* AI Suggestion Button */}
        <Button
          onClick={handleGenerateSuggestion}
          size="lg"
          className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 shadow-lg hover:shadow-yellow-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <Sparkles className="w-5 h-5" />
          Get AI Suggestion
        </Button>

        {/* Token Garden Grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-emerald-100">Your Ideas</h2>
          {tokens.length === 0 ? (
            <div className="bg-gradient-to-br from-emerald-900/40 to-green-900/40 backdrop-blur-sm rounded-xl p-8 border border-emerald-600/30 text-center">
              <p className="text-emerald-400/60 text-lg">No ideas yet. Add your first idea above to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tokens.map((token, index) => {
                const cluster = clusters.find(c => c.id === token.clusterId);
                return (
                  <div
                    key={token.id}
                    className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-xl p-5 border border-emerald-600/30 shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105 hover:border-emerald-500/50"
                    style={{
                      animation: `fadeIn 0.5s ease-out ${index * 0.1}s both`,
                    }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-lg flex-shrink-0"
                        style={{
                          background: cluster
                            ? `linear-gradient(to br, ${cluster.color}, ${cluster.color}dd)`
                            : 'linear-gradient(to br, #10b981, #059669)'
                        }}
                      >
                        {token.text.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingLabelId === token.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={labelValue}
                              onChange={(e) => setLabelValue(e.target.value)}
                              onBlur={() => saveLabelEdit(token.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveLabelEdit(token.id);
                                if (e.key === 'Escape') {
                                  setEditingLabelId(null);
                                  setLabelValue('');
                                }
                              }}
                              autoFocus
                              className="flex-1 px-3 py-2 bg-emerald-950/50 text-emerald-100 border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-bold"
                            />
                            <button
                              onClick={() => saveLabelEdit(token.id)}
                              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingLabelId(null);
                                setLabelValue('');
                              }}
                              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-emerald-100 truncate flex-1">
                              {token.text}
                            </h3>
                            <button
                              onClick={() => startLabelEdit(token)}
                              className="p-1.5 bg-emerald-700/50 hover:bg-emerald-600 text-emerald-200 rounded-lg transition-colors flex-shrink-0"
                              title="Edit idea name"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {cluster && (
                      <div className="mb-3 flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cluster.color }}
                        />
                        <span className="text-xs text-emerald-300/80 font-medium">
                          In cluster: {cluster.name}
                        </span>
                      </div>
                    )}

                    {editingId === token.id ? (
                      <div className="space-y-3">
                        <label className="text-xs text-emerald-300/80 font-medium block mb-1">
                          Description:
                        </label>
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-3 py-2 bg-emerald-950/50 text-emerald-100 border-2 border-emerald-600/50 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/50 resize-none"
                          rows={4}
                          placeholder="Add a description for this idea..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(token.id)}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-lg transition-all duration-300 font-medium hover:scale-105 active:scale-95 shadow-lg hover:shadow-emerald-500/50 flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Save Description
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditValue('');
                            }}
                            className="px-4 py-2 bg-emerald-800/50 hover:bg-emerald-700/50 text-emerald-200 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-emerald-300/80 font-medium">Description:</label>
                            <button
                              onClick={() => startEdit(token)}
                              className="text-xs px-2 py-1 bg-emerald-700/50 hover:bg-emerald-600 text-emerald-200 rounded transition-colors flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              {token.description ? 'Edit' : 'Add'}
                            </button>
                          </div>
                          <div
                            onClick={() => startEdit(token)}
                            className="min-h-[60px] px-3 py-2 bg-emerald-950/30 rounded-lg cursor-pointer hover:bg-emerald-950/50 transition-colors border border-emerald-800/30"
                          >
                            <p className="text-sm text-emerald-100/90">
                              {token.description ? (
                                token.description
                              ) : (
                                <span className="italic text-emerald-400/50">Click to add a description...</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
