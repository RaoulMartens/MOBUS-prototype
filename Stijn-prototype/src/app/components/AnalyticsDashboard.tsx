import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Grid3x3, Activity, Lightbulb, Clock, Sparkles } from 'lucide-react';
import { useTokens } from '../contexts/TokenContext';
import { Badge } from '../../imports/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../imports/card';

export function AnalyticsDashboard() {
  const { tokens, clusters, events, loading, backendConnected } = useTokens();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tokensToday = tokens.filter(t => new Date(t.createdAt) >= today).length;
    const suggestionsGiven = events.filter(e => e.type === 'suggestion').length;

    return {
      totalTokens: tokens.length,
      activeClusters: clusters.length,
      tokensToday,
      suggestionsGiven
    };
  }, [tokens, clusters, events]);

  // Generate System Insights
  const systemInsights = useMemo(() => {
    const insights: Array<{ text: string; timestamp: Date; type: 'cluster' | 'suggestion' | 'welcome' }> = [];

    // Welcome message if no tokens
    if (tokens.length === 0) {
      insights.push({
        text: '🌱 Welcome to your Idea Ecosystem! Start by adding tokens on Screen 2 (Canvas) or Screen 3 (Input).',
        timestamp: new Date(),
        type: 'welcome'
      });
      return insights;
    }

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
        insights.push({
          text: `🌱 Cluster "${cluster.name}" detected with ${tokenTexts.length} ideas: ${tokenTexts.slice(0, 3).join(', ')}${tokenTexts.length > 3 ? '...' : ''}. These concepts appear to form a cohesive theme.`,
          timestamp: new Date(),
          type: 'cluster'
        });
      }
    });

    // Suggestion insights from events
    const recentSuggestions = events
      .filter(e => e.type === 'suggestion')
      .slice(0, 3);

    recentSuggestions.forEach(suggestion => {
      insights.push({
        text: `💡 ${suggestion.message}`,
        timestamp: new Date(suggestion.timestamp),
        type: 'suggestion'
      });
    });

    if (insights.length === 0) {
      insights.push({
        text: '✨ Connect tokens on Screen 2 by moving them close together to discover relationships and generate insights!',
        timestamp: new Date(),
        type: 'welcome'
      });
    }

    return insights.slice(0, 10);
  }, [tokens, clusters, events]);

  // Generate activity data from events
  const activityData = useMemo(() => {
    const hours = Array.from({ length: 6 }, (_, i) => {
      const hour = new Date();
      hour.setHours(hour.getHours() - (5 - i));
      return hour;
    });

    return hours.map((hour, index) => {
      const hourStart = new Date(hour);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      const tokenEvents = events.filter(e => {
        const eventTime = new Date(e.timestamp);
        return e.type === 'created' && eventTime >= hourStart && eventTime < hourEnd;
      }).length;

      const clusterEvents = events.filter(e => {
        const eventTime = new Date(e.timestamp);
        return e.type === 'clustered' && eventTime >= hourStart && eventTime < hourEnd;
      }).length;

      return {
        id: `hour-${index}`,
        time: hourStart.getHours() + ':00',
        tokens: tokenEvents,
        clusters: clusterEvents
      };
    });
  }, [events]);

  // Cluster distribution
  const clusterDistribution = useMemo(() => {
    const distribution = clusters.map(cluster => ({
      name: cluster.name,
      value: cluster.tokenIds.length,
      color: cluster.color
    }));

    const unclusteredCount = tokens.filter(t => !t.clusterId).length;
    if (unclusteredCount > 0) {
      distribution.push({
        name: 'Unclustered',
        value: unclusteredCount,
        color: '#6b7280'
      });
    }

    return distribution;
  }, [tokens, clusters]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created': return <Lightbulb className="w-4 h-4" />;
      case 'clustered': return <Grid3x3 className="w-4 h-4" />;
      case 'suggestion': return <TrendingUp className="w-4 h-4" />;
      case 'moved': return <Activity className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created': return 'bg-blue-500';
      case 'clustered': return 'bg-purple-500';
      case 'suggestion': return 'bg-green-500';
      case 'moved': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string | Date) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const diff = Math.floor((currentTime.getTime() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950">
        <div className="text-emerald-100 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-emerald-950 via-green-950 to-teal-950 text-white overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-emerald-100">🌿 System Insights & Analytics</h1>
            {backendConnected && (
              <Badge variant="default" className="bg-emerald-900/80 border-emerald-700/50 text-green-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Screen 1 - Live
              </Badge>
            )}
          </div>
          <p className="text-emerald-300/80">Real-time insights and analytics for your idea ecosystem</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-300/80 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">Total Ideas</span>
              </div>
              <div className="text-3xl font-bold text-emerald-100">{stats.totalTokens}</div>
              <div className="text-sm text-green-400 mt-1">+{stats.tokensToday} today</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-300/80 mb-2">
                <Grid3x3 className="w-4 h-4" />
                <span className="text-sm">Active Clusters</span>
              </div>
              <div className="text-3xl font-bold text-emerald-100">{stats.activeClusters}</div>
              <div className="text-sm text-emerald-300/80 mt-1">Organized groups</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-300/80 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Activity Today</span>
              </div>
              <div className="text-3xl font-bold text-emerald-100">{stats.tokensToday}</div>
              <div className="text-sm text-emerald-300/80 mt-1">Ideas created</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm border-emerald-600/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-300/80 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm">AI Insights</span>
              </div>
              <div className="text-3xl font-bold text-emerald-100">{stats.suggestionsGiven}</div>
              <div className="text-sm text-emerald-300/80 mt-1">Generated</div>
            </CardContent>
          </Card>
        </div>

        {/* System Insights */}
        <div className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-lg p-6 border border-emerald-600/30">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold text-emerald-100">AI-Generated Insights</h2>
          </div>
          <div className="space-y-3">
            {systemInsights.map((insight, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${
                  insight.type === 'suggestion'
                    ? 'bg-gradient-to-br from-yellow-900/40 to-amber-900/40 border-yellow-600/50 hover:border-yellow-500/70'
                    : insight.type === 'cluster'
                    ? 'bg-gradient-to-br from-emerald-800/40 to-green-900/40 border-emerald-600/30 hover:border-emerald-500/50'
                    : 'bg-gradient-to-br from-teal-900/40 to-cyan-900/40 border-teal-600/30 hover:border-teal-500/50'
                }`}
              >
                <p className="text-sm text-emerald-100 leading-relaxed">{insight.text}</p>
                <span className="text-xs text-emerald-400/70 mt-2 block">
                  {formatTime(insight.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Chart */}
        {activityData.some(d => d.tokens > 0 || d.clusters > 0) && (
          <div className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30">
            <h2 className="text-lg font-semibold text-emerald-100 mb-4">Activity Timeline</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#065f46" />
                <XAxis dataKey="time" stroke="#6ee7b7" />
                <YAxis stroke="#6ee7b7" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '8px', color: '#d1fae5' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                <Line type="monotone" dataKey="tokens" stroke="#34d399" strokeWidth={2} name="Ideas Created" />
                <Line type="monotone" dataKey="clusters" stroke="#10b981" strokeWidth={2} name="Clusters Formed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cluster Distribution */}
        {clusterDistribution.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30">
            <h2 className="text-lg font-semibold text-emerald-100 mb-4">Cluster Distribution</h2>
            <div className="flex items-center gap-8">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={clusterDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {clusterDistribution.map((entry, index) => (
                      <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#064e3b', border: '1px solid #059669', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {clusterDistribution.map((cluster) => (
                  <div key={cluster.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cluster.color }} />
                      <span className="text-sm text-emerald-200">{cluster.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-100">{cluster.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity Feed */}
        {events.length > 0 && (
          <div className="bg-gradient-to-br from-emerald-900/60 to-green-900/60 backdrop-blur-sm rounded-lg p-4 border border-emerald-600/30">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-emerald-100">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {events.slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 bg-emerald-800/30 rounded-lg hover:bg-emerald-800/50 transition-colors">
                  <div className={`${getEventColor(event.type)} p-2 rounded-lg text-white`}>
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-emerald-100">{event.message}</p>
                    <p className="text-xs text-emerald-400/70 mt-1">{formatTime(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
