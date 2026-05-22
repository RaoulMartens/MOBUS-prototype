import { useState, useEffect } from 'react';

interface Token {
  id: string;
  label: string;
  description: string;
}

interface Connection {
  from: string;
  to: string;
}

interface SystemInputPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  tokens: Token[];
  connections: Connection[];
  randomSuggestions: Set<string>;
}

export function SystemInputPanel({ isOpen, onToggle, tokens, connections, randomSuggestions }: SystemInputPanelProps) {
  // Generate insights dynamically based on current clusters
  const generateInsights = () => {
    const insights: Array<{ text: string; timestamp: Date; type: 'cluster' | 'suggestion' }> = [];

    // Add random system suggestions first
    if (randomSuggestions.size > 0) {
      const suggestedTokens = Array.from(randomSuggestions)
        .map(id => tokens.find(t => t.id === id))
        .filter(t => t !== undefined);

      if (suggestedTokens.length >= 2) {
        const labels = suggestedTokens.map(t => t.label).join(', ');
        insights.push({
          text: `💡 System suggestion: Consider connecting ${labels}`,
          timestamp: new Date(),
          type: 'suggestion'
        });
      }
    }

    if (!connections || connections.length === 0) {
      if (insights.length === 0) {
        insights.push({
          text: 'No clusters detected. Move tokens close together to create connections.',
          timestamp: new Date(),
          type: 'cluster'
        });
      }
      return insights;
    }

    // Find clusters (groups of connected tokens)
    const clusters: Set<string>[] = [];
    const visited = new Set<string>();

    const findCluster = (tokenId: string, cluster: Set<string>) => {
      if (visited.has(tokenId)) return;
      visited.add(tokenId);
      cluster.add(tokenId);

      connections.forEach(conn => {
        if (conn.from === tokenId && !visited.has(conn.to)) {
          findCluster(conn.to, cluster);
        }
        if (conn.to === tokenId && !visited.has(conn.from)) {
          findCluster(conn.from, cluster);
        }
      });
    };

    connections.forEach(conn => {
      if (!visited.has(conn.from)) {
        const cluster = new Set<string>();
        findCluster(conn.from, cluster);
        if (cluster.size > 1) {
          clusters.push(cluster);
        }
      }
    });

    if (clusters.length === 0) {
      if (insights.length === 0) {
        insights.push({
          text: 'No clusters detected. Move tokens close together to create connections.',
          timestamp: new Date(),
          type: 'cluster'
        });
      }
      return insights;
    }

    // Generate insights for each cluster
    clusters.forEach((cluster, index) => {
      const clusterTokens = Array.from(cluster).map(id =>
        tokens.find(t => t.id === id)
      ).filter(t => t !== undefined);

      if (clusterTokens.length >= 2) {
        const labels = clusterTokens.map(t => t.label).join(', ');
        const descriptions = clusterTokens
          .filter(t => t.description)
          .map(t => t.description);

        let insight = `Cluster ${index + 1}: ${labels}. `;

        if (descriptions.length >= 2) {
          insight += `These concepts (${descriptions.join(', ')}) may form a cohesive theme.`;
        } else if (descriptions.length === 1) {
          insight += `Centered around: ${descriptions[0]}.`;
        } else {
          insight += 'Consider adding descriptions to identify common themes.';
        }

        insights.push({ text: insight, timestamp: new Date(), type: 'cluster' });
      }
    });

    return insights;
  };

  const messages = generateInsights();

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 bg-gradient-to-l from-emerald-900/95 to-green-900/95 backdrop-blur-md border-l border-emerald-700/50 transition-all duration-300 shadow-2xl ${
        isOpen ? 'w-80' : 'w-10'
      }`}
    >
      <div className="flex flex-col h-full">
        <button
          onClick={onToggle}
          className="flex items-center justify-between px-3 h-10 border-b border-emerald-700/50 hover:bg-emerald-800/50 transition-colors w-full"
        >
          {isOpen && <h3 className="text-sm font-semibold text-emerald-100">🌿 System Insights</h3>}
          <span className="text-emerald-400 ml-auto">
            {isOpen ? '▶' : '◀'}
          </span>
        </button>

        {isOpen && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`rounded-lg p-3 border backdrop-blur-sm shadow-lg transition-all hover:scale-[1.02] ${
                  message.type === 'suggestion'
                    ? 'bg-gradient-to-br from-yellow-900/40 to-amber-900/40 border-yellow-600/50 hover:border-yellow-500'
                    : 'bg-gradient-to-br from-emerald-800/40 to-green-900/40 border-emerald-600/30 hover:border-emerald-500/50'
                }`}
              >
                <p className="text-xs text-emerald-100 mb-1.5 leading-relaxed">{message.text}</p>
                <span className="text-xs text-emerald-400/70">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
