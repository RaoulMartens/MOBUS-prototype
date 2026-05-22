import { useState, useRef } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTokens } from '../contexts/TokenContext';
import { Plus, X, Sparkles } from 'lucide-react';

const ItemTypes = {
  TOKEN: 'token'
};

interface DraggableTokenProps {
  id: string;
  text: string;
  clusterId: string | null;
}

function DraggableToken({ id, text, clusterId }: DraggableTokenProps) {
  const { removeTokenFromCluster, clusters } = useTokens();
  const [{ isDragging }, drag] = useDrag(() => ({
    type: ItemTypes.TOKEN,
    item: { id, text },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }));

  const cluster = clusters.find(c => c.id === clusterId);

  return (
    <div
      ref={drag}
      className={`px-3 py-2 rounded-lg cursor-move transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      style={{
        backgroundColor: cluster ? cluster.color : '#374151',
        border: cluster ? `2px solid ${cluster.color}` : '2px solid #4b5563'
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-white">{text}</span>
        {clusterId && (
          <button
            onClick={() => removeTokenFromCluster(id)}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ClusterDropZoneProps {
  id: string;
  name: string;
  color: string;
  tokenIds: string[];
}

function ClusterDropZone({ id, name, color, tokenIds }: ClusterDropZoneProps) {
  const { tokens, addTokenToCluster } = useTokens();
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ItemTypes.TOKEN,
    drop: (item: { id: string }) => {
      addTokenToCluster(item.id, id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    })
  }));

  const clusterTokens = tokens.filter(t => tokenIds.includes(t.id));

  return (
    <div
      ref={drop}
      className={`p-4 rounded-lg border-2 border-dashed transition-all min-h-32 ${
        isOver ? 'bg-gray-700 border-white' : 'bg-gray-800 border-gray-600'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="font-semibold text-white">{name}</h3>
        <span className="text-xs text-gray-400">({clusterTokens.length})</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {clusterTokens.map(token => (
          <DraggableToken
            key={token.id}
            id={token.id}
            text={token.text}
            clusterId={token.clusterId}
          />
        ))}
      </div>
    </div>
  );
}

export function TokenClustering() {
  const { tokens, clusters, addToken, createCluster, addEvent, loading, backendConnected } = useTokens();
  const [newTokenText, setNewTokenText] = useState('');
  const [newClusterName, setNewClusterName] = useState('');
  const [showClusterForm, setShowClusterForm] = useState(false);

  const unclusteredTokens = tokens.filter(t => !t.clusterId);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  const handleAddToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTokenText.trim()) {
      addToken(newTokenText.trim(), { x: 0, y: 0 });
      setNewTokenText('');
    }
  };

  const handleCreateCluster = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClusterName.trim()) {
      createCluster(newClusterName.trim(), []);
      setNewClusterName('');
      setShowClusterForm(false);
    }
  };

  const handleGenerateSuggestion = () => {
    const suggestions = [
      'Consider grouping "AI" and "Machine Learning" tokens together',
      'Tokens about "Design" could form a new cluster',
      'Similar tokens detected - merge "Backend" and "API" clusters?',
      'Unclustered tokens may belong in "Research" cluster'
    ];
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    addEvent('suggestion', randomSuggestion);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col p-6 bg-gray-900 overflow-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">Token Clustering</h1>
            {backendConnected && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-500">Screen 2 - Live</span>
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm">Drag tokens to organize them into clusters</p>
        </div>

        {/* Add Token Form */}
        <form onSubmit={handleAddToken} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenText}
              onChange={(e) => setNewTokenText(e.target.value)}
              placeholder="Enter new idea..."
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Token
            </button>
          </div>
        </form>

        {/* AI Suggestion Button */}
        <button
          onClick={handleGenerateSuggestion}
          className="mb-6 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors w-fit"
        >
          <Sparkles className="w-4 h-4" />
          Get AI Suggestion
        </button>

        {/* Unclustered Tokens */}
        {unclusteredTokens.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Unclustered Tokens</h2>
            <div className="flex flex-wrap gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
              {unclusteredTokens.map(token => (
                <DraggableToken
                  key={token.id}
                  id={token.id}
                  text={token.text}
                  clusterId={token.clusterId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Clusters */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Clusters</h2>
            <button
              onClick={() => setShowClusterForm(!showClusterForm)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
            >
              {showClusterForm ? 'Cancel' : 'New Cluster'}
            </button>
          </div>

          {showClusterForm && (
            <form onSubmit={handleCreateCluster} className="mb-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newClusterName}
                  onChange={(e) => setNewClusterName(e.target.value)}
                  placeholder="Cluster name..."
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {clusters.map(cluster => (
              <ClusterDropZone
                key={cluster.id}
                id={cluster.id}
                name={cluster.name}
                color={cluster.color}
                tokenIds={cluster.tokenIds}
              />
            ))}
            {clusters.length === 0 && !showClusterForm && (
              <p className="text-gray-500 text-center py-8">No clusters yet. Create one to get started!</p>
            )}
          </div>
        </div>
      </div>
    </DndProvider>
  );
}
