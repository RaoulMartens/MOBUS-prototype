import { useMemo, useState, useEffect, useRef } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// Network IPs injected by Vite at build time
declare const __NETWORK_IPS__: string[];
const networkIPs: string[] = typeof __NETWORK_IPS__ !== 'undefined' ? __NETWORK_IPS__ : [];

const getNetworkPhoneUrl = (sessionId: string): string => {
  const { hostname, port, protocol } = window.location;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}${port ? ':' + port : ''}/phone?sessionId=${sessionId}`;
  }
  if (networkIPs.length > 0) {
    return `${protocol}//${networkIPs[0]}${port ? ':' + port : ''}/phone?sessionId=${sessionId}`;
  }
  return `${window.location.origin}/phone?sessionId=${sessionId}`;
};

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

interface Explanation {
  reasons: string[];
  question: string;
}

function generateRelationExplanation(tokenA: { text: string; description?: string }, tokenB: { text: string; description?: string }): Explanation {
  const wordsA = normalizeWords(`${tokenA.text} ${tokenA.description || ''}`);
  const wordsB = normalizeWords(`${tokenB.text} ${tokenB.description || ''}`);

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  // Find shared keywords
  const sharedKeywords: string[] = [];
  setA.forEach(w => {
    if (setB.has(w) && w.length > 3) {
      sharedKeywords.push(w);
    }
  });

  // Find matching themes for both
  const matchedThemes: string[] = [];
  THEME_RULES.forEach(theme => {
    const hasA = theme.keywords.some(kw =>
      wordsA.some(w => w.includes(kw) || kw.includes(w))
    );
    const hasB = theme.keywords.some(kw =>
      wordsB.some(w => w.includes(kw) || kw.includes(w))
    );
    if (hasA && hasB) {
      matchedThemes.push(theme.label);
    }
  });

  const reasons: string[] = [];

  // Theme-based reasons
  if (matchedThemes.length > 0) {
    reasons.push(`ze allebei aansluiten bij het thema **${matchedThemes[0]}**`);
  } else if (sharedKeywords.length > 0) {
    reasons.push(`ze beide praten over onderwerpen rondom **"${sharedKeywords.slice(0, 2).map(toTitleCase).join(' & ')}"**`);
  } else {
    reasons.push(`ze een gemeenschappelijke ondergrond lijken te hebben in jullie sessie`);
  }

  // Phase/Implementation reason
  const cleanA = tokenA.text.toLowerCase() + ' ' + (tokenA.description || '').toLowerCase();
  const cleanB = tokenB.text.toLowerCase() + ' ' + (tokenB.description || '').toLowerCase();

  const isTechA = cleanA.includes('ai') || cleanA.includes('robot') || cleanA.includes('techno') || cleanA.includes('systeem') || cleanA.includes('digitaal') || cleanA.includes('data') || cleanA.includes('computer');
  const isTechB = cleanB.includes('ai') || cleanB.includes('robot') || cleanB.includes('techno') || cleanB.includes('systeem') || cleanB.includes('digitaal') || cleanB.includes('data') || cleanB.includes('computer');

  const isHumanA = cleanA.includes('mens') || cleanA.includes('team') || cleanA.includes('crea') || cleanA.includes('burger') || cleanA.includes('samen') || cleanA.includes('sociaal') || cleanA.includes('gevoel') || cleanA.includes('ethiek');
  const isHumanB = cleanB.includes('mens') || cleanB.includes('team') || cleanB.includes('crea') || cleanB.includes('burger') || cleanB.includes('samen') || cleanB.includes('sociaal') || cleanB.includes('gevoel') || cleanB.includes('ethiek');

  if ((isTechA && isHumanB) || (isTechB && isHumanA)) {
    reasons.push(`het ene idee de technische mogelijkheden verkent, terwijl het andere juist de menselijke of sociale factor centraal stelt`);
  } else if (cleanA.includes('praktisch') || cleanA.includes('doen') || cleanB.includes('praktisch') || cleanB.includes('doen') || cleanA.includes('concrete') || cleanB.includes('concrete')) {
    reasons.push(`ze een interessante spanning laten zien tussen een concrete, praktische aanpak en een meer conceptueel idee`);
  } else {
    reasons.push(`ze elkaar aanvullen in hoe ze de sessie vormgeven`);
  }

  // 3rd reason: creative facilitator nudge
  if (matchedThemes.length > 1) {
    reasons.push(`ze ook raken aan aspecten van **${matchedThemes[1]}**`);
  } else {
    reasons.push(`ze samen een bredere oplossingsrichting lijken te openen`);
  }

  // Creative question
  let question = `Wat gebeurt er als je "${tokenA.text}" combineert met "${tokenB.text}"?`;
  if (matchedThemes.includes('Mensgerichte Technologie')) {
    question = `Hoe kunnen de technologie in "${tokenA.text}" en de menselijke maat in "${tokenB.text}" elkaar versterken?`;
  } else if (matchedThemes.includes('Veilige en Eerlijke Keuzes')) {
    question = `Welke morele of ethische grens moeten we bewaken als we "${tokenA.text}" en "${tokenB.text}" samenbrengen?`;
  } else if (matchedThemes.includes('Samenwerking en Eigenaarschap')) {
    question = `Wie zou de kartrekker moeten zijn als we "${tokenA.text}" en "${tokenB.text}" als één geheel oppakken?`;
  } else if (matchedThemes.includes('Duurzame Impact')) {
    question = `Wat voor positieve impact op de lange termijn ontstaat er als we "${tokenA.text}" koppelen aan "${tokenB.text}"?`;
  } else if ((isTechA && isHumanB) || (isTechB && isHumanA)) {
    question = `Hoe zorgt de menselijke factor ervoor dat het technische systeem van deze ideeën betrouwbaar en prettig blijft?`;
  }

  return { reasons: reasons.slice(0, 3), question };
}

function renderReason(reason: string) {
  const parts = reason.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 700, color: '#09090b' }}>{part}</strong> : part
  );
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
  const { tokens, loading, sessionId, activeRelation } = useTokens();
  const [isThinking, setIsThinking] = useState(false);
  const prevTokensSignature = useRef('');
  const [insight, setInsight] = useState<{
    state: 'standby' | 'suggestion' | 'reflection' | 'summary';
    title: string;
    message: string;
    themeLabel?: string;
    relatedIdeaIds: string[];
    confidence: number;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const insightRef = doc(db, "sessions", sessionId, "state", "insight");
    const unsubscribe = onSnapshot(insightRef, (snapshot) => {
      if (snapshot.exists()) {
        setInsight(snapshot.data() as any);
      } else {
        setInsight(null);
      }
    }, (err) => {
      console.error("Error loading live insight:", err);
    });
    return () => unsubscribe();
  }, [sessionId]);

  const clusterableTokens = useMemo(() => {
    return tokens;
  }, [tokens]);

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
    if (clusterableTokens.length === 0) return [];

    // ── Proximity clustering (same logic as before) ──
    const SNAP_DISTANCE = 140;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

    const adj: Record<string, string[]> = {};
    clusterableTokens.forEach(t => { adj[t.id] = []; });

    for (let i = 0; i < clusterableTokens.length; i++) {
      for (let j = i + 1; j < clusterableTokens.length; j++) {
        if (dist(clusterableTokens[i].position, clusterableTokens[j].position) < SNAP_DISTANCE) {
          adj[clusterableTokens[i].id].push(clusterableTokens[j].id);
          adj[clusterableTokens[j].id].push(clusterableTokens[i].id);
        }
      }
    }

    // BFS connected components
    const visited = new Set<string>();
    const components: typeof tokens[] = [];

    clusterableTokens.forEach(t => {
      if (visited.has(t.id)) return;
      const comp: typeof tokens = [];
      const queue = [t.id];
      visited.add(t.id);
      while (queue.length > 0) {
        const cid = queue.shift()!;
        const tk = clusterableTokens.find(x => x.id === cid);
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

      let label = "";
      const validClusterName = comp.find(t => t.ai_metadata?.cluster_name && t.ai_metadata.cluster_name !== "null" && t.ai_metadata.cluster_name !== "none")?.ai_metadata?.cluster_name;
      if (validClusterName) {
        label = validClusterName;
      } else {
        label = generateClusterLabel(comp, idx);
      }

      const suggestion = comp.length >= 3
        ? pickSuggestion(SUGGESTIONS_3PLUS, idx)
        : comp.length >= 2
          ? pickSuggestion(SUGGESTIONS_2, idx)
          : null;

      return { label, ideas, suggestion };
    });
  }, [clusterableTokens]);

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <span style={styles.loadingText}>Laden...</span>
      </div>
    );
  }

  if (activeRelation) {
    const tokenA = tokens.find(t => t.id === activeRelation.sourceId);
    const tokenB = tokens.find(t => t.id === activeRelation.targetId);

    if (tokenA && tokenB) {
      const explanation = generateRelationExplanation(tokenA, tokenB);

      return (
        <div style={styles.activeRelationRoot} className="animate-fade-in">
          <div style={styles.activeRelationContainer}>
            <div style={styles.activeRelationCard}>
              <div style={styles.cardHeaderSmall}>Mogelijke connectie</div>

              <div style={styles.activeRelationIdeasRow}>
                <div style={styles.activeRelationIdea}>
                  {tokenA.drawingDataUrl && (
                    <img src={tokenA.drawingDataUrl} alt="" style={styles.relationIdeaSketch} />
                  )}
                  <div style={styles.relationIdeaTitle}>{tokenA.ai_metadata?.title || tokenA.text}</div>
                  <div style={styles.relationIdeaDesc}>
                    {tokenA.ai_metadata?.summary || tokenA.description}
                  </div>
                  {tokenA.ai_metadata?.creative_intent && (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '0.4rem', color: '#71717a' }}>
                      <strong>Intentie:</strong> {tokenA.ai_metadata.creative_intent}
                    </div>
                  )}
                </div>

                <div style={styles.plusSign}>+</div>

                <div style={styles.activeRelationIdea}>
                  {tokenB.drawingDataUrl && (
                    <img src={tokenB.drawingDataUrl} alt="" style={styles.relationIdeaSketch} />
                  )}
                  <div style={styles.relationIdeaTitle}>{tokenB.ai_metadata?.title || tokenB.text}</div>
                  <div style={styles.relationIdeaDesc}>
                    {tokenB.ai_metadata?.summary || tokenB.description}
                  </div>
                  {tokenB.ai_metadata?.creative_intent && (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '0.4rem', color: '#71717a' }}>
                      <strong>Intentie:</strong> {tokenB.ai_metadata.creative_intent}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.explanationSection}>
                <div style={styles.explanationIntro}>Deze ideeën sluiten op elkaar aan omdat:</div>
                <ul style={styles.reasonsList}>
                  {tokenA.ai_metadata?.possible_connections && tokenA.ai_metadata.possible_connections.length > 0 ? (
                    tokenA.ai_metadata.possible_connections.map((conn, idx) => (
                      <li key={idx} style={styles.reasonItem}>
                        <span style={styles.bullet}>•</span>
                        <span>{conn}</span>
                      </li>
                    ))
                  ) : tokenB.ai_metadata?.possible_connections && tokenB.ai_metadata.possible_connections.length > 0 ? (
                    tokenB.ai_metadata.possible_connections.map((conn, idx) => (
                      <li key={idx} style={styles.reasonItem}>
                        <span style={styles.bullet}>•</span>
                        <span>{conn}</span>
                      </li>
                    ))
                  ) : (
                    explanation.reasons.map((reason, rIdx) => (
                      <li key={rIdx} style={styles.reasonItem}>
                        <span style={styles.bullet}>•</span>
                        <span>{renderReason(reason)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div style={styles.questionSection}>
                <div style={styles.questionLabel}>Creatieve vraag:</div>
                <div style={styles.questionText}>{explanation.question}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  const hasIdeas = tokens.length > 0;
  const hasClusters = clusterCards.length > 0;

  if (!hasIdeas) {
    return (
      <div style={styles.landingRoot} className="animate-fade-in">
        <div style={styles.landingContainer}>
          <h1 style={styles.landingTitle}>Sessie gestart</h1>
          <p style={styles.landingSubtitle}>
            Verbind je telefoon om je eerste idee toe te voegen.
          </p>

          <div style={styles.landingCard}>
            <div style={styles.landingCardLeft}>
              <div style={styles.landingQrWrapper}>
                <QRCodeSVG
                  value={getNetworkPhoneUrl(sessionId)}
                  size={120}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                />
              </div>
              <span style={styles.landingCardLabel}>SCAN MET JE TELEFOON</span>
            </div>

            <div style={styles.landingDivider} />

            <div style={styles.landingCardRight}>
              <span style={styles.landingCardLabel}>SESSIECODE</span>
              <span style={styles.landingSessionCode}>
                {sessionId.replace(/^mobus-/, '')}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root} className="animate-fade-in">
      <style>{`
        @keyframes thinking-pulse {
          0% { box-shadow: 0 0 0 0 rgba(127, 211, 140, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(127, 211, 140, 0); }
          100% { box-shadow: 0 0 0 0 rgba(127, 211, 140, 0); }
        }
        .pulse-active {
          animation: thinking-pulse 1.6s infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <div>
              <h1 style={styles.title}>Overzicht</h1>
              <p style={styles.subtitle}>Terwijl jullie ideeën groeien, ontdekt MOBUS patronen, connecties en nieuwe richtingen.</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          </div>
        </header>

        {/* ── Main Viewport Layout ── */}
        <div style={styles.mainLayout}>
          {/* ── Left Column: Live AI Reflection ── */}
          <div style={styles.leftColumn}>
            {insight && insight.state !== "standby" ? (
              <div style={styles.liveInsightCard} className="animate-fade-in">
                <div style={styles.liveInsightHeader}>
                  <span style={styles.liveInsightBadge}>
                    ✨ {insight.state === "suggestion" ? "AI Suggestie" : insight.state === "reflection" ? "AI Reflectievraag" : "AI Samenvatting"}
                  </span>
                  {insight.themeLabel && (
                    <span style={styles.liveInsightTheme}>{insight.themeLabel}</span>
                  )}
                </div>
                <h3 style={styles.liveInsightTitle}>{insight.title}</h3>
                <p style={styles.liveInsightMessage}>{insight.message}</p>
              </div>
            ) : (
              <div style={styles.liveInsightStandbyCard} className="animate-fade-in">
                <span style={styles.liveInsightStandbyBadge}>🔮 MOBUS stand-by</span>
                <p style={styles.liveInsightStandbyText}>
                  Beweeg ideeën op de tafel om patronen, groepen en AI-inzichten te ontdekken.
                </p>
              </div>
            )}
            
            {/* Join card with QR code */}
            <div style={{
              marginTop: 'auto',
              backgroundColor: '#ffffff',
              border: '1px solid #a1a1aa',
              borderRadius: 4,
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                padding: '0.4rem',
                backgroundColor: '#ffffff',
                borderRadius: 4,
                border: '1px solid #d4d4d8',
                display: 'inline-block',
                flexShrink: 0
              }}>
                <QRCodeSVG
                  value={getNetworkPhoneUrl(sessionId)}
                  size={64}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 705, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Doe mee!
                </span>
                <span style={{ fontSize: '0.8rem', color: '#27272a', fontWeight: 600 }}>
                  Scan de QR-code met je telefoon
                </span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#71717a', marginTop: '0.1rem' }}>
                  Code: <strong style={{ color: '#09090b', fontWeight: 700 }}>{sessionId.replace(/^mobus-/, '')}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* ── Right Column: Manual Groups Grid ── */}
          <div style={styles.rightColumn}>
            {hasIdeas && !hasClusters && (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>Nog geen groepjes</p>
                <p style={styles.emptyDesc}>
                  Sleep ideeën op de tafel naar elkaar toe om clusters te vormen. Ze verschijnen hier automatisch.
                </p>
                <div style={styles.ideaCount}>{tokens.length} {tokens.length === 1 ? 'idee' : 'ideeën'} op tafel</div>
              </div>
            )}

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
                        {card.ideas.map((idea, cIdx) => {
                          const originalToken = tokens.find(t => t.text === idea.text || t.ai_metadata?.title === idea.text);
                          return (
                            <span key={cIdx} style={{
                              ...styles.chip,
                              flexDirection: 'column',
                              alignItems: 'flex-start',
                              gap: '0.25rem',
                              padding: '0.5rem 0.75rem'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                                <span style={{ fontWeight: 600 }}>{originalToken?.ai_metadata?.title || idea.text}</span>
                              </div>
                              {originalToken?.ai_metadata?.summary && (
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#52525b', maxWidth: '280px', lineHeight: '1.3' }}>
                                  {originalToken.ai_metadata.summary}
                                </p>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline styles (wireframe, no CSS file needed) ──
const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f4f4f5',
    overflow: 'hidden',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#09090b',
    boxSizing: 'border-box',
  },
  container: {
    width: '100%',
    height: '100%',
    padding: '2rem 3rem',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '1.5rem',
    flexShrink: 0,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    gap: '2.5rem',
    minHeight: 0,
  },
  leftColumn: {
    width: '320px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  rightColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
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
    margin: '0 0 0.25rem 0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#71717a',
    margin: 0,
  },
  // Stats
  statsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1rem',
    flexShrink: 0,
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
    flexDirection: 'row' as const,
    gap: '1.25rem',
    overflowX: 'auto',
    overflowY: 'hidden',
    flex: 1,
    minHeight: 0,
    paddingBottom: '0.75rem',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #a1a1aa',
    borderRadius: 4,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    width: '340px',
    flexShrink: 0,
    maxHeight: '100%',
    boxSizing: 'border-box',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
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
    flexDirection: 'column' as const,
    gap: '0.5rem',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
    paddingRight: '0.25rem',
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
  liveInsightCard: {
    backgroundColor: '#ffffff',
    border: '2px solid #09090b',
    borderRadius: 4,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  liveInsightHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveInsightBadge: {
    fontSize: '0.75rem',
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#ffffff',
    backgroundColor: '#09090b',
    border: '1px solid #09090b',
    borderRadius: 4,
    padding: '0.25rem 0.6rem',
  },
  liveInsightTheme: {
    fontSize: '0.75rem',
    fontWeight: 650,
    color: '#52525b',
    backgroundColor: '#f4f4f5',
    border: '1px solid #d4d4d8',
    borderRadius: 4,
    padding: '0.25rem 0.6rem',
  },
  liveInsightTitle: {
    fontSize: '1.35rem',
    fontWeight: 900,
    margin: 0,
    letterSpacing: '-0.02em',
    color: '#09090b',
  },
  liveInsightMessage: {
    fontSize: '1.05rem',
    color: '#27272a',
    lineHeight: 1.5,
    margin: 0,
    fontWeight: 500,
  },
  liveInsightStandbyCard: {
    backgroundColor: '#ffffff',
    border: '1px dashed #a1a1aa',
    borderRadius: 4,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  liveInsightStandbyBadge: {
    fontSize: '0.75rem',
    fontWeight: 750,
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  liveInsightStandbyText: {
    fontSize: '0.9rem',
    color: '#a1a1aa',
    margin: 0,
    lineHeight: 1.5,
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

  landingRoot: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f4f4f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#09090b',
  },
  landingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    gap: '1rem',
  },
  landingTitle: {
    fontSize: '2.5rem',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-0.02em',
    color: '#09090b',
  },
  landingSubtitle: {
    fontSize: '1.1rem',
    color: '#52525b',
    margin: '0 0 1.5rem 0',
  },
  landingCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: 8,
    padding: '2.5rem 3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2.5rem',
  },
  landingCardLeft: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.75rem',
  },
  landingQrWrapper: {
    padding: '0.5rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: 4,
  },
  landingCardLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#71717a',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
  },
  landingDivider: {
    width: 1,
    height: 120,
    backgroundColor: '#e4e4e7',
  },
  landingCardRight: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    minWidth: 160,
  },
  landingSessionCode: {
    fontSize: '3.25rem',
    fontWeight: 800,
    fontFamily: "monospace, 'Courier New', Courier",
    color: '#09090b',
    letterSpacing: '0.05em',
    lineHeight: 1,
  },
  activeRelationRoot: {
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f4f4f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#09090b',
    padding: '2rem',
    boxSizing: 'border-box' as const,
  },
  activeRelationContainer: {
    maxWidth: 900,
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  activeRelationCard: {
    backgroundColor: '#ffffff',
    border: '2px solid #09090b',
    borderRadius: 8,
    padding: '3rem',
    width: '100%',
    boxSizing: 'border-box' as const,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2.5rem',
    position: 'relative' as const,
    backgroundImage: `
      repeating-linear-gradient(0deg, transparent 0px, transparent 24px, #f4f4f5 24px, #f4f4f5 25px),
      repeating-linear-gradient(90deg, transparent 0px, transparent 24px, #f4f4f5 24px, #f4f4f5 25px)
    `,
    backgroundSize: '25px 25px',
  },
  cardHeaderSmall: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#10b981',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    textAlign: 'center' as const,
  },
  activeRelationIdeasRow: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: '2rem',
    width: '100%',
  },
  activeRelationIdea: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    border: '1px solid #d4d4d8',
    borderRadius: 6,
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    justifyContent: 'center',
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
  },
  relationIdeaSketch: {
    width: '120px',
    height: '90px',
    objectFit: 'contain' as const,
    marginBottom: '1rem',
    backgroundColor: 'transparent',
  },
  relationIdeaTitle: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#09090b',
    marginBottom: '0.5rem',
    lineHeight: 1.3,
  },
  relationIdeaDesc: {
    fontSize: '0.95rem',
    color: '#71717a',
    lineHeight: 1.5,
  },
  plusSign: {
    fontSize: '2.5rem',
    fontWeight: 300,
    color: '#a1a1aa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  explanationSection: {
    borderTop: '1px solid #e4e4e7',
    paddingTop: '2rem',
  },
  explanationIntro: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#52525b',
    marginBottom: '1.25rem',
  },
  reasonsList: {
    listStyleType: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  reasonItem: {
    fontSize: '1.1rem',
    color: '#27272a',
    lineHeight: 1.6,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
  },
  bullet: {
    color: '#10b981',
    fontWeight: 900,
  },
  questionSection: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 6,
    padding: '2rem',
    boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)',
  },
  questionLabel: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#047857',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '0.5rem',
  },
  questionText: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#064e3b',
    lineHeight: 1.4,
  },
};
