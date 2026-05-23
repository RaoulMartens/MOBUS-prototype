import { useMemo, useState } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export function SystemInsights() {
  const { tokens, clusters, events, loading, backendConnected, addEvent } = useTokens();
  const [generating, setGenerating] = useState(false);

  const handleGenerateSuggestion = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      if (tokens.length < 2) {
        await addEvent(
          'suggestion',
          'Voeg meer ideeën toe op je telefoon of de tafel om AI-relatiesuggesties te ontgrendelen!'
        );
        return;
      }

      // Select two random tokens
      const shuffled = [...tokens].sort(() => Math.random() - 0.5);
      const t1 = shuffled[0];
      const t2 = shuffled[1];

      const templates = [
        `Hoe zou de combinatie van "${t1.text}" en "${t2.text}" eruitzien als een nieuw concept?`,
        `Overweeg "${t1.text}" en "${t2.text}" dichter bij elkaar te plaatsen om de synergie te verkennen.`,
        `Kun je "${t1.text}" inzetten als een oplossing of hulpmiddel voor "${t2.text}"?`,
        `Welke gemeenschappelijke factor verbindt "${t1.text}" met "${t2.text}"?`,
        `Hoe beïnvloedt het succes van "${t1.text}" de haalbaarheid of impact van "${t2.text}"?`
      ];

      const message = templates[Math.floor(Math.random() * templates.length)];
      await addEvent('suggestion', message);
    } catch (err) {
      console.error("Failed to generate suggestion event:", err);
    } finally {
      setGenerating(false);
    }
  };

  const insights = useMemo(() => {
    const results: Array<{ text: string; timestamp: Date; type: 'cluster' | 'suggestion' | 'welcome' }> = [];

    // Welcome message if no tokens
    if (tokens.length === 0) {
      results.push({
        text: 'Welkom! Voeg eerst wat ideeën toe via de mobiele app om connecties te kunnen leggen.',
        timestamp: new Date(),
        type: 'welcome'
      });
      return results;
    }

    // Add suggestion insights from events
    const recentSuggestions = events
      .filter(e => e.type === 'suggestion')
      .slice(0, 5); // show up to 5 recent suggestions

    recentSuggestions.forEach(suggestion => {
      results.push({
        text: `${suggestion.message}`,
        timestamp: new Date(suggestion.timestamp),
        type: 'suggestion'
      });
    });

    // 1. DYNAMIC PROXIMITY CLUSTERING (Real-time detection based on coordinates)
    const SNAP_DISTANCE = 140;
    const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    // Build adjacency list for connected tokens
    const adj: Record<string, string[]> = {};
    tokens.forEach(t => {
      adj[t.id] = [];
    });

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        const t1 = tokens[i];
        const t2 = tokens[j];
        if (getDistance(t1.position, t2.position) < SNAP_DISTANCE) {
          adj[t1.id].push(t2.id);
          adj[t2.id].push(t1.id);
        }
      }
    }

    // Find connected components (dynamic groups)
    const visited = new Set<string>();
    let dynamicClusterIndex = 1;

    tokens.forEach(t => {
      if (!visited.has(t.id)) {
        const component: typeof tokens = [];
        const queue = [t.id];
        visited.add(t.id);

        while (queue.length > 0) {
          const currId = queue.shift()!;
          const currToken = tokens.find(tk => tk.id === currId);
          if (currToken) {
            component.push(currToken);
          }

          adj[currId].forEach(neighborId => {
            if (!visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          });
        }

        // If 2 or more tokens are close to each other, it's a cluster!
        if (component.length >= 2) {
          const labels = component.map(tk => tk.text).join(' + ');
          const descriptions = component
            .filter(tk => tk.description)
            .map(tk => `"${tk.text}": ${tk.description}`);

          let insight = `🌱 Cluster gedetecteerd op tafel: ${labels}. `;

          if (descriptions.length >= 2) {
            insight += `Thematische overlap gevonden: ${descriptions.join(', ')}. Overweeg deze groep verder uit te werken.`;
          } else if (descriptions.length === 1) {
            insight += `Toelichting bij ${descriptions[0]}. Voeg via je telefoon meer beschrijvingen toe om diepere verbanden te tonen.`;
          } else {
            insight += 'Geef deze ideeën een beschrijving in de mobiele app om thematische overlap te ontdekken!';
          }

          results.push({
            text: insight,
            timestamp: new Date(),
            type: 'cluster'
          });
          dynamicClusterIndex++;
        }
      }
    });

    // 2. FIRESTORE EXPLICIT CLUSTERS (from Stijn's database structure)
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

        let insight = `🌿 Database Groep "${cluster.name}" actief: ${labels}. `;

        if (descriptions.length >= 2) {
          insight += `Samenhang: ${descriptions.join(' | ')}.`;
        } else {
          insight += 'Voeg beschrijvingen toe via de mobiele app om gemeenschappelijke thema\'s te belichten.';
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
        text: 'Nog geen inzichten. Sleep ideeën op het tafelscherm naar elkaar toe om connecties te maken!',
        timestamp: new Date(),
        type: 'welcome'
      });
    }

    return results;
  }, [tokens, clusters, events]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950">
        <div className="text-emerald-100 text-lg">Inzichten laden...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 overflow-auto animate-fadeIn">
      <div className="max-w-4xl mx-auto p-8 pt-16">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-emerald-100 mb-2">🌿 System Insights</h2>
            <p className="text-emerald-300/80">Real-time analyses en suggesties om verbanden tussen ideeën te ontdekken.</p>
          </div>
          <div className="flex flex-col items-end gap-3 flex-shrink-0">
            {backendConnected && (
              <Badge variant="default" className="bg-emerald-900/80 border-emerald-700/50 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                Screen 1 - Live
              </Badge>
            )}
            <Button
              onClick={handleGenerateSuggestion}
              disabled={generating}
              className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-yellow-950 font-bold border border-yellow-400/30 hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-amber-950/40"
            >
              ✨ Genereer AI Suggestie
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {insights.map((message, index) => (
            <Card
              key={index}
              className={`backdrop-blur-sm shadow-xl transition-all duration-300 hover:scale-[1.01] cursor-default ${
                message.type === 'suggestion'
                  ? 'bg-gradient-to-br from-yellow-900/40 to-amber-900/40 border-yellow-600/30 hover:border-yellow-500/50 hover:shadow-yellow-500/10'
                  : message.type === 'welcome'
                  ? 'bg-gradient-to-br from-emerald-900/30 to-green-900/30 border-emerald-700/20'
                  : 'bg-gradient-to-br from-emerald-900/60 to-green-900/60 border-emerald-600/40 hover:border-emerald-500/60 hover:shadow-emerald-500/10'
              }`}
              style={{
                animation: `slideIn 0.4s ease-out ${index * 0.08}s both`,
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'suggestion'
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : message.type === 'welcome'
                      ? 'bg-teal-500/10 text-teal-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    <span className="text-xl">{message.type === 'suggestion' ? '💡' : message.type === 'welcome' ? '✨' : '🌱'}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-emerald-100 leading-relaxed mb-2 text-[15px] font-medium">{message.text}</p>
                    <span className="text-xs text-emerald-400/60">
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
