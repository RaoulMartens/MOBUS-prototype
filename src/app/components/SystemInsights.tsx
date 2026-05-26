import { useMemo, useState, useEffect, useRef } from 'react';
import { useTokens } from '../contexts/TokenContext';

// ── Suggestion templates per cluster size ──
const SUGGESTIONS_2 = [
  'Deze twee ideeën lijken op elkaar. Wat is de kern?',
  'Overweeg deze ideeën samen te voegen tot één concept.',
  'Welke overlap zie je tussen deze twee?',
];
const SUGGESTIONS_3PLUS = [
  'Misschien vormen deze ideeën samen één werkwijze.',
  'Welk overkoepelend thema verbindt deze groep?',
  'Probeer deze groep een naam te geven.',
  'Kun je hier een prioriteit uit kiezen?',
];

function pickSuggestion(templates: string[], seed: number): string {
  return templates[seed % templates.length];
}

// ── Auto-generate a cluster label from idea texts ──
const STOP_WORDS = new Set([
  'aan', 'als', 'bij', 'dat', 'de', 'deze', 'die', 'dit', 'door', 'een', 'en',
  'er', 'het', 'hier', 'hoe', 'in', 'is', 'kan', 'met', 'naar', 'niet', 'nog',
  'om', 'op', 'te', 'tot', 'uit', 'van', 'voor', 'wat', 'we', 'wel', 'zijn',
  'the', 'and', 'for', 'from', 'that', 'this', 'with',
]);

const THEME_RULES = [
  {
    label: 'Mensgerichte Technologie',
    keywords: ['ai', 'robot', 'technologie', 'tech', 'digitaal', 'systeem', 'data', 'automatisering', 'mens', 'team'],
  },
  {
    label: 'Veilige en Eerlijke Keuzes',
    keywords: ['ethiek', 'veilig', 'risico', 'privacy', 'vertrouwen', 'eerlijk', 'transparant', 'controle'],
  },
  {
    label: 'Samenwerking en Eigenaarschap',
    keywords: ['samen', 'team', 'groep', 'community', 'deelname', 'participatie', 'co-creatie', 'eigenaarschap'],
  },
  {
    label: 'Duurzame Impact',
    keywords: ['duurzaam', 'milieu', 'impact', 'circulair', 'energie', 'klimaat', 'toekomst', 'sociaal'],
  },
  {
    label: 'Leren en Experimenteren',
    keywords: ['leren', 'onderwijs', 'training', 'experiment', 'prototype', 'testen', 'feedback', 'onderzoek'],
  },
  {
    label: 'Toegankelijke Ervaring',
    keywords: ['toegankelijk', 'ervaring', 'gebruiker', 'gebruikers', 'interface', 'simpel', 'duidelijk', 'inclusief'],
  },
];

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));
}

function toTitleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function generateClusterLabel(items: Array<{ text: string; description?: string }>, index: number): string {
  const combinedText = items
    .map(item => `${item.text} ${item.description || ''}`)
    .join(' ');
  const words = normalizeWords(combinedText);

  const bestTheme = THEME_RULES
    .map(theme => ({
      label: theme.label,
      score: theme.keywords.reduce((score, keyword) => (
        score + words.filter(word => word.includes(keyword) || keyword.includes(word)).length
      ), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (bestTheme && bestTheme.score >= 2) {
    return bestTheme.label;
  }

  const counts = new Map<string, number>();
  words.forEach(word => counts.set(word, (counts.get(word) || 0) + 1));

  const keywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 2)
    .map(([word]) => toTitleCase(word));

  if (keywords.length >= 2) {
    return `${keywords[0]} & ${keywords[1]}`;
  }

  if (keywords.length === 1) {
    return `${keywords[0]} als Kernidee`;
  }

  return `Thema ${index + 1}`;
}

interface ClusterCardIdea {
  text: string;
  drawingDataUrl: string | null;
}

interface ClusterCard {
  label: string;
  ideas: ClusterCardIdea[];
  suggestion: string | null;
}

export function SystemInsights() {
  const { tokens, loading, sessionId } = useTokens();
  const [isThinking, setIsThinking] = useState(false);
  const prevTokensSignature = useRef('');

  useEffect(() => {
    document.title = "MOBUS - Wandscherm";
  }, []);

  useEffect(() => {
    const signature = JSON.stringify(tokens.map(t => ({ id: t.id, x: t.position.x, y: t.position.y, clusterId: t.clusterId })));
    if (prevTokensSignature.current && signature !== prevTokensSignature.current) {
      setIsThinking(true);
      const timer = setTimeout(() => setIsThinking(false), 3500);
      return () => clearTimeout(timer);
    }
    prevTokensSignature.current = signature;
  }, [tokens]);

  // Periodic passive check-in
  useEffect(() => {
    const interval = setInterval(() => {
      setIsThinking(true);
      setTimeout(() => setIsThinking(false), 2500);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const clusterCards = useMemo<ClusterCard[]>(() => {
    if (tokens.length === 0) return [];

    // ── Proximity clustering (same logic as before) ──
    const SNAP_DISTANCE = 140;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

    const adj: Record<string, string[]> = {};
    tokens.forEach(t => { adj[t.id] = []; });

    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        if (dist(tokens[i].position, tokens[j].position) < SNAP_DISTANCE) {
          adj[tokens[i].id].push(tokens[j].id);
          adj[tokens[j].id].push(tokens[i].id);
        }
      }
    }

    // BFS connected components
    const visited = new Set<string>();
    const components: typeof tokens[] = [];

    tokens.forEach(t => {
      if (visited.has(t.id)) return;
      const comp: typeof tokens = [];
      const queue = [t.id];
      visited.add(t.id);
      while (queue.length > 0) {
        const cid = queue.shift()!;
        const tk = tokens.find(x => x.id === cid);
        if (tk) comp.push(tk);
        adj[cid].forEach(nid => {
          if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
        });
      }
      if (comp.length >= 2) components.push(comp);
    });

    // Build cards
    return components.map((comp, idx) => {
      const ideas = comp.map(t => ({
        text: t.text,
        drawingDataUrl: t.drawingDataUrl || null,
      }));
      const label = generateClusterLabel(comp, idx);
      const suggestion = comp.length >= 3
        ? pickSuggestion(SUGGESTIONS_3PLUS, idx)
        : comp.length >= 2
          ? pickSuggestion(SUGGESTIONS_2, idx)
          : null;

      return { label, ideas, suggestion };
    });
  }, [tokens]);

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <span style={styles.loadingText}>Laden...</span>
      </div>
    );
  }

  const hasIdeas = tokens.length > 0;
  const hasClusters = clusterCards.length > 0;

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes thinking-pulse {
          0% { box-shadow: 0 0 0 0 rgba(127, 211, 140, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(127, 211, 140, 0); }
          100% { box-shadow: 0 0 0 0 rgba(127, 211, 140, 0); }
        }
        .pulse-active {
          animation: thinking-pulse 1.6s infinite;
        }
      `}</style>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div>
              <h1 style={styles.title}>Overzicht</h1>
              <p style={styles.subtitle}>Terwijl jullie ideeën groeien, ontdekt MOBUS patronen, connecties en nieuwe richtingen om samen te verkennen.</p>
            </div>
            <div style={{
              ...styles.thinkingIndicator,
              opacity: isThinking ? 1 : 0.45
            }}>
              <span
                className={isThinking ? "pulse-active" : ""}
                style={isThinking ? styles.thinkingDotActive : styles.thinkingDotIdle}
              />
              <span style={styles.thinkingText}>
                {isThinking ? "MOBUS denkt mee" : "MOBUS stand-by"}
              </span>
            </div>
          </div>
        </header>

        {/* ── Empty: no ideas at all ── */}
        {!hasIdeas && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Nog geen ideeën</p>
            <p style={styles.emptyDesc}>
              Voeg ideeën toe via de mobiele app. Ze verschijnen hier zodra er groepjes ontstaan op de tafel.
            </p>
          </div>
        )}

        {/* ── Ideas exist but no clusters yet ── */}
        {hasIdeas && !hasClusters && (
          <div style={styles.emptyState}>
            <p style={styles.emptyTitle}>Nog geen groepjes</p>
            <p style={styles.emptyDesc}>
              Sleep ideeën op de tafel naar elkaar toe om clusters te vormen. Ze verschijnen hier automatisch.
            </p>
            <div style={styles.ideaCount}>{tokens.length} {tokens.length === 1 ? 'idee' : 'ideeën'} op tafel</div>
          </div>
        )}

        {/* ── Cluster cards ── */}
        {hasClusters && (
          <>
            <div style={styles.statsRow}>
              <span style={styles.statChip}>{clusterCards.length} {clusterCards.length === 1 ? 'groep' : 'groepen'}</span>
              <span style={styles.statChip}>{tokens.length} ideeën totaal</span>
            </div>

            <div style={styles.cardGrid}>
              {clusterCards.map((card, idx) => (
                <div key={idx} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <span style={styles.cardLabel}>{card.label}</span>
                    <span style={styles.cardCount}>{card.ideas.length}</span>
                  </div>

                  <div style={styles.chipRow}>
                    {card.ideas.map((idea, cIdx) => (
                      <span key={cIdx} style={styles.chip}>
                        {idea.drawingDataUrl && (
                          <img
                            src={idea.drawingDataUrl}
                            alt=""
                            style={{
                              width: '32px',
                              height: '24px',
                              objectFit: 'contain',
                              backgroundColor: 'transparent',
                              borderRadius: '2px',
                            }}
                          />
                        )}
                        <span>{idea.text}</span>
                      </span>
                    ))}
                  </div>

                  {card.suggestion && (
                    <p style={styles.suggestion}>{card.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline styles (wireframe, no CSS file needed) ──
const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f4f4f5',
    overflow: 'auto',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#09090b',
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '4rem 2rem',
  },
  header: {
    marginBottom: '2.5rem',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  thinkingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#ffffff',
    border: '1px solid #a1a1aa',
    borderRadius: 4,
    padding: '0.4rem 0.8rem',
    transition: 'all 0.3s ease',
  },
  thinkingDotActive: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#7fd38c',
    display: 'inline-block',
  },
  thinkingDotIdle: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: '#d4d4d8',
    display: 'inline-block',
  },
  thinkingText: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#09090b',
    fontFamily: "'Inter', sans-serif",
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: '0 0 0.5rem 0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#71717a',
    margin: 0,
  },
  // Stats
  statsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  statChip: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#52525b',
    backgroundColor: '#e4e4e7',
    border: '1px solid #a1a1aa',
    borderRadius: 4,
    padding: '0.3rem 0.75rem',
  },
  // Cards
  cardGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #a1a1aa',
    borderRadius: 4,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#09090b',
  },
  cardCount: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#71717a',
    backgroundColor: '#f4f4f5',
    border: '1px solid #a1a1aa',
    borderRadius: 9999,
    padding: '0.15rem 0.55rem',
    minWidth: 24,
    textAlign: 'center' as const,
  },
  // Chips
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  chip: {
    fontSize: '0.825rem',
    fontWeight: 500,
    color: '#27272a',
    backgroundColor: '#f4f4f5',
    border: '1px solid #d4d4d8',
    borderRadius: 4,
    padding: '0.3rem 0.65rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  // Suggestion
  suggestion: {
    fontSize: '0.875rem',
    color: '#52525b',
    fontStyle: 'italic',
    margin: 0,
    paddingTop: '0.25rem',
    borderTop: '1px solid #e4e4e7',
  },
  // Empty
  emptyState: {
    backgroundColor: '#ffffff',
    border: '1px solid #a1a1aa',
    borderRadius: 4,
    padding: '3rem 2rem',
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.5rem',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    margin: 0,
  },
  emptyDesc: {
    fontSize: '0.9rem',
    color: '#71717a',
    margin: 0,
    maxWidth: '36ch',
    lineHeight: 1.5,
  },
  ideaCount: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#52525b',
    backgroundColor: '#f4f4f5',
    border: '1px solid #d4d4d8',
    borderRadius: 4,
    padding: '0.3rem 0.75rem',
    marginTop: '0.5rem',
  },
  // Loading
  loadingWrapper: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f4f5',
  },
  loadingText: {
    fontSize: '1rem',
    color: '#71717a',
  },
};
