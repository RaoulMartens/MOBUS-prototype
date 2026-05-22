import { useMemo } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Card, CardContent } from '../../imports/card';
import { Badge } from '../../imports/badge';

export function SystemInsights() {
  const { tokens, clusters, events, loading, backendConnected } = useTokens();

  const insights = useMemo(() => {
    const results: Array<{ text: string; timestamp: Date; type: 'cluster' | 'suggestion' | 'welcome' }> = [];

    // Welcome message if no tokens
    if (tokens.length === 0) {
      results.push({
        text: 'Welcome! Start by moving ideas close together on the canvas to create connections.',
        timestamp: new Date(),
        type: 'welcome'
      });
      return results;
    }

    // Add suggestion insights from events
    const recentSuggestions = events
      .filter(e => e.type === 'suggestion')
      .slice(0, 3);

    recentSuggestions.forEach(suggestion => {
      results.push({
        text: `💡 ${suggestion.message}`,
        timestamp: new Date(suggestion.timestamp),
        type: 'suggestion'
      });
    });

    // Find cluster insights
    const clusterMap = new Map<string, string[]>();
    tokens.forEach(token => {
      if (token.clusterId) {
        const cluster = clusters.find(c => c.id === token.clusterId);
        if (cluster) {
          if (!clusterMap.has(cluster.id)) {
            clusterMap.set(cluster.id, []);
          }
          clusterMap.get(cluster.id)!.push(token.text);
        }
      }
    });

    clusterMap.forEach((tokenTexts, clusterId) => {
      const cluster = clusters.find(c => c.id === clusterId);
      if (cluster && tokenTexts.length >= 2) {
        const labels = tokenTexts.join(', ');
        const descriptions = tokens
          .filter(t => t.clusterId === clusterId && t.description)
          .map(t => t.description);

        let insight = `🌱 Cluster "${cluster.name}" detected: ${labels}. `;

        if (descriptions.length >= 2) {
          insight += `These concepts (${descriptions.join(', ')}) appear to form a cohesive theme. Consider developing this cluster further.`;
        } else if (descriptions.length === 1) {
          insight += `Centered around: ${descriptions[0]}. Add more descriptions in the Idea Garden to uncover deeper connections.`;
        } else {
          insight += 'Visit the Idea Garden to add descriptions and identify common themes.';
        }

        results.push({
          text: insight,
          timestamp: new Date(),
          type: 'cluster'
        });
      }
    });

    if (results.length === 0) {
      results.push({
        text: 'No insights yet. Create some connections on the canvas to get started!',
        timestamp: new Date(),
        type: 'welcome'
      });
    }

    return results;
  }, [tokens, clusters, events]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950">
        <div className="text-emerald-100 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 overflow-auto animate-fadeIn">
      <div className="max-w-4xl mx-auto p-8 pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-emerald-100 mb-2">🌿 System Insights</h2>
            <p className="text-emerald-300/80">Real-time insights and suggestions from the system to help you discover connections.</p>
          </div>
          {backendConnected && (
            <Badge variant="default" className="bg-emerald-900/80 border-emerald-700/50 text-green-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Screen 1 - Live
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {insights.map((message, index) => (
            <Card
              key={index}
              className={`backdrop-blur-sm shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-default ${
                message.type === 'suggestion'
                  ? 'bg-gradient-to-br from-yellow-900/50 to-amber-900/50 border-yellow-600/50 hover:border-yellow-500/70 hover:shadow-yellow-500/20'
                  : 'bg-gradient-to-br from-emerald-900/60 to-green-900/60 border-emerald-600/30 hover:border-emerald-500/50 hover:shadow-emerald-500/20'
              }`}
              style={{
                animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <CardContent className="p-6">
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
              </CardContent>
            </Card>
          ))}
        </div>

        {insights.length === 0 && (
          <div className="text-center py-20">
            <p className="text-emerald-400/60 text-lg">No insights yet. Create some connections on the canvas to get started!</p>
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

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
