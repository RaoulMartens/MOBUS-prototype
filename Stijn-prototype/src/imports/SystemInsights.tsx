interface Token {
  id: string;
  label: string;
  description: string;
}

interface Connection {
  from: string;
  to: string;
}

interface SystemInsightsProps {
  tokens: Token[];
  connections: Connection[];
  randomSuggestions: Set<string>;
}

export function SystemInsights({ tokens, connections, randomSuggestions }: SystemInsightsProps) {
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
          text: `💡 System suggestion: Consider connecting ${labels}. These ideas might complement each other.`,
          timestamp: new Date(),
          type: 'suggestion'
        });
      }
    }

    if (!connections || connections.length === 0) {
      if (insights.length === 0) {
        insights.push({
          text: 'Welcome! Start by moving ideas close together on the canvas to create connections.',
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

        let insight = `🌱 Cluster ${index + 1} detected: ${labels}. `;

        if (descriptions.length >= 2) {
          insight += `These concepts (${descriptions.join(', ')}) appear to form a cohesive theme. Consider developing this cluster further.`;
        } else if (descriptions.length === 1) {
          insight += `Centered around: ${descriptions[0]}. Add more descriptions in the Idea Garden to uncover deeper connections.`;
        } else {
          insight += 'Visit the Idea Garden to add descriptions and identify common themes.';
        }

        insights.push({ text: insight, timestamp: new Date(), type: 'cluster' });
      }
    });

    return insights;
  };

  const messages = generateInsights();

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 overflow-auto pt-16 animate-fadeIn">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-emerald-100 mb-2">🌿 System Insights</h2>
          <p className="text-emerald-300/80">Real-time insights and suggestions from the system to help you discover connections.</p>
        </div>

        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`rounded-xl p-6 border backdrop-blur-sm shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-default ${
                message.type === 'suggestion'
                  ? 'bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border-yellow-600/50 hover:border-yellow-500/70 hover:shadow-yellow-500/20'
                  : 'bg-gradient-to-br from-emerald-900/60 to-green-900/60 border-emerald-600/30 hover:border-emerald-500/50 hover:shadow-emerald-500/20'
              }`}
              style={{
                animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.type === 'suggestion'
                    ? 'bg-yellow-500/20'
                    : 'bg-emerald-500/20'
                }`}>
                  <span className="text-2xl">{message.type === 'suggestion' ? '💡' : '🌱'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-emerald-100 leading-relaxed mb-2">{message.text}</p>
                  <span className="text-xs text-emerald-400/70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="text-center py-20">
            <p className="text-emerald-400/60 text-lg">No insights yet. Create some connections on the canvas to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
