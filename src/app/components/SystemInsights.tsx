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

// ── Local semantic helpers ────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'aan', 'als', 'bij', 'dat', 'de', 'deze', 'die', 'dit', 'door', 'een', 'en',
  'er', 'het', 'hier', 'hoe', 'in', 'is', 'kan', 'met', 'naar', 'niet', 'nog',
  'om', 'op', 'te', 'tot', 'uit', 'van', 'voor', 'wat', 'we', 'wel', 'zijn',
  'the', 'and', 'for', 'from', 'that', 'this', 'with',
]);

const THEME_RULES = [
  { label: 'Mensgerichte Technologie', keywords: ['ai', 'robot', 'technologie', 'tech', 'digitaal', 'systeem', 'data', 'automatisering', 'mens', 'team'] },
  { label: 'Veilige en Eerlijke Keuzes', keywords: ['ethiek', 'veilig', 'risico', 'privacy', 'vertrouwen', 'eerlijk', 'transparant', 'controle'] },
  { label: 'Samenwerking en Eigenaarschap', keywords: ['samen', 'team', 'groep', 'community', 'deelname', 'participatie', 'co-creatie', 'eigenaarschap'] },
  { label: 'Duurzame Impact', keywords: ['duurzaam', 'milieu', 'impact', 'circulair', 'energie', 'klimaat', 'toekomst', 'sociaal'] },
  { label: 'Leren en Experimenteren', keywords: ['leren', 'onderwijs', 'training', 'experiment', 'prototype', 'testen', 'feedback', 'onderzoek'] },
  { label: 'Toegankelijke Ervaring', keywords: ['toegankelijk', 'ervaring', 'gebruiker', 'gebruikers', 'interface', 'simpel', 'duidelijk', 'inclusief'] },
];

function normalizeWords(text: string): string[] {
  return text.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).map(w => w.trim()).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function detectTheme(texts: string[]): string | null {
  const words = normalizeWords(texts.join(' '));
  const best = THEME_RULES.map(r => ({
    label: r.label,
    score: r.keywords.reduce((s, k) => s + words.filter(w => w.includes(k) || k.includes(w)).length, 0),
  })).sort((a, b) => b.score - a.score)[0];
  return (best && best.score >= 2) ? best.label : null;
}

function detectTension(texts: string[]): boolean {
  const combined = texts.join(' ').toLowerCase();
  const isTech = combined.includes('ai') || combined.includes('robot') || combined.includes('technologie') || combined.includes('digitaal') || combined.includes('systeem');
  const isHuman = combined.includes('mens') || combined.includes('ethiek') || combined.includes('sociaal') || combined.includes('gevoel') || combined.includes('samen') || combined.includes('veilig');
  return isTech && isHuman;
}

// ── Wall state types ──────────────────────────────────────────────────────────
type WallStateType = 'standby' | 'emerging' | 'user_group' | 'ai_suggestion' | 'tension' | 'naming';

interface WallState {
  type: WallStateType;
  label?: string;     // theme label
  ideaA?: string;     // for tension/suggestion
  ideaB?: string;
  count?: number;     // group size
}

// ── Relation explanation (kept for activeRelation view) ─────────────────────
function generateRelationExplanation(
  tokenA: { text: string; description?: string },
  tokenB: { text: string; description?: string }
): { reasons: string[]; question: string } {
  const wordsA = normalizeWords(`${tokenA.text} ${tokenA.description || ''}`);
  const wordsB = normalizeWords(`${tokenB.text} ${tokenB.description || ''}`);
  const setA = new Set(wordsA);
  const sharedKeywords: string[] = [];
  setA.forEach(w => { if (new Set(wordsB).has(w) && w.length > 3) sharedKeywords.push(w); });

  const matchedThemes: string[] = [];
  THEME_RULES.forEach(theme => {
    const hasA = theme.keywords.some(kw => wordsA.some(w => w.includes(kw) || kw.includes(w)));
    const hasB = theme.keywords.some(kw => wordsB.some(w => w.includes(kw) || kw.includes(w)));
    if (hasA && hasB) matchedThemes.push(theme.label);
  });

  const reasons: string[] = [];
  if (matchedThemes.length > 0) reasons.push(`ze allebei aansluiten bij het thema **${matchedThemes[0]}**`);
  else if (sharedKeywords.length > 0) reasons.push(`ze beide praten over onderwerpen rondom **"${sharedKeywords.slice(0, 2).join(' & ')}"**`);
  else reasons.push(`ze een gemeenschappelijke ondergrond lijken te hebben in jullie sessie`);
  reasons.push(`ze elkaar aanvullen in hoe ze de sessie vormgeven`);

  const question = matchedThemes.includes('Mensgerichte Technologie')
    ? `Hoe kunnen de technologie in "${tokenA.text}" en de menselijke maat in "${tokenB.text}" elkaar versterken?`
    : `Wat gebeurt er als je "${tokenA.text}" combineert met "${tokenB.text}"?`;

  return { reasons: reasons.slice(0, 2), question };
}

function renderReason(reason: string) {
  const parts = reason.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} style={{ fontWeight: 700, color: '#09090b' }}>{part}</strong> : part
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SystemInsights() {
  const { tokens, loading, sessionId, activeRelation } = useTokens();
  const [isThinking, setIsThinking] = useState(false);
  const prevTokensSignature = useRef('');
  const [firestoreInsight, setFirestoreInsight] = useState<{
    state: string; title: string; message: string; themeLabel?: string; relatedIdeaIds: string[]; confidence: number;
  } | null>(null);

  // Live insight from Firestore (AI backend writes this)
  useEffect(() => {
    if (!sessionId) return;
    const insightRef = doc(db, 'sessions', sessionId, 'state', 'insight');
    const unsub = onSnapshot(insightRef, snap => {
      setFirestoreInsight(snap.exists() ? (snap.data() as any) : null);
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => { document.title = 'MOBUS - Wandscherm'; }, []);

  // Thinking pulse on token movement
  useEffect(() => {
    const sig = JSON.stringify(tokens.map(t => ({ id: t.id, x: t.position.x, y: t.position.y })));
    if (prevTokensSignature.current && sig !== prevTokensSignature.current) {
      setIsThinking(true);
      const t = setTimeout(() => setIsThinking(false), 2500);
      return () => clearTimeout(t);
    }
    prevTokensSignature.current = sig;
  }, [tokens]);

  // ── Derive wall state from token positions ─────────────────────────────────
  const wallState = useMemo<WallState>(() => {
    if (tokens.length === 0) return { type: 'standby' };

    const SNAP = 140;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y);

    // Find connected components
    const adj: Record<string, string[]> = {};
    tokens.forEach(t => { adj[t.id] = []; });
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        if (dist(tokens[i].position, tokens[j].position) < SNAP) {
          adj[tokens[i].id].push(tokens[j].id);
          adj[tokens[j].id].push(tokens[i].id);
        }
      }
    }

    const visited = new Set<string>();
    const components: typeof tokens[] = [];
    tokens.forEach(t => {
      if (visited.has(t.id)) return;
      const comp: typeof tokens = [];
      const q = [t.id];
      visited.add(t.id);
      while (q.length) {
        const cid = q.shift()!;
        const tk = tokens.find(x => x.id === cid);
        if (tk) comp.push(tk);
        adj[cid].forEach(nid => { if (!visited.has(nid)) { visited.add(nid); q.push(nid); } });
      }
      if (comp.length >= 2) components.push(comp);
    });

    // Firestore AI suggestion takes priority (but only suggestion/reflection state)
    if (firestoreInsight && firestoreInsight.state !== 'standby') {
      // Map AI insight to our wall state
      if (firestoreInsight.state === 'suggestion') return { type: 'ai_suggestion' };
      if (firestoreInsight.state === 'reflection') {
        // Check for tension in any group
        if (components.length > 0) {
          const hasTension = components.some(comp => detectTension(comp.map(t => `${t.text} ${t.description || ''}`)));
          if (hasTension) {
            const tensionGroup = components.find(comp => detectTension(comp.map(t => `${t.text} ${t.description || ''}`)))!;
            return { type: 'tension', ideaA: tensionGroup[0].text, ideaB: tensionGroup[tensionGroup.length - 1].text };
          }
        }
        return { type: 'user_group', count: components[0]?.length };
      }
    }

    // Local derivation
    if (components.length === 0) {
      // No groups yet — check if tokens are drifting close (proximity)
      let closestDist = Infinity;
      for (let i = 0; i < tokens.length; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
          const d = dist(tokens[i].position, tokens[j].position);
          if (d < closestDist) closestDist = d;
        }
      }
      if (tokens.length >= 2 && closestDist < 240) {
        return { type: 'emerging' };
      }
      return { type: 'standby' };
    }

    // We have groups — check for tension first
    const tensionGroup = components.find(comp => detectTension(comp.map(t => `${t.text} ${t.description || ''}`)));
    if (tensionGroup) {
      const techToken = tensionGroup.find(t => {
        const c = `${t.text} ${t.description || ''}`.toLowerCase();
        return c.includes('ai') || c.includes('robot') || c.includes('technologie') || c.includes('digitaal');
      });
      const humanToken = tensionGroup.find(t => {
        const c = `${t.text} ${t.description || ''}`.toLowerCase();
        return c.includes('mens') || c.includes('ethiek') || c.includes('sociaal') || c.includes('gevoel');
      });
      return {
        type: 'tension',
        ideaA: techToken?.text || tensionGroup[0].text,
        ideaB: humanToken?.text || tensionGroup[1]?.text,
      };
    }

    // Check for nameable group with a detected theme
    const themeGroup = components.find(comp => detectTheme(comp.map(t => `${t.text} ${t.description || ''}`)) !== null);
    if (themeGroup) {
      const theme = detectTheme(themeGroup.map(t => `${t.text} ${t.description || ''}`));
      return { type: 'naming', label: theme ?? undefined, count: themeGroup.length };
    }

    // Default: user group reflection
    return { type: 'user_group', count: components[0].length };
  }, [tokens, firestoreInsight]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.loadingRoot}>
        <span style={s.loadingText}>Laden…</span>
      </div>
    );
  }

  // ── No ideas yet: full landing with QR ────────────────────────────────────
  if (tokens.length === 0) {
    return (
      <div style={s.landingRoot} className="anim-fade-in">
        <WallStyles />
        <div style={s.landingInner}>
          <div style={s.landingLeft}>
            <p style={s.landingEyebrow}>MOBUS — Wandscherm</p>
            <h1 style={s.landingTitle}>Sessie gestart</h1>
            <p style={s.landingSubtitle}>Verbind je telefoon om je eerste idee toe te voegen aan de tafel.</p>
          </div>
          <div style={s.landingDivider} />
          <div style={s.landingRight}>
            <div style={s.qrWrap}>
              <QRCodeSVG value={getNetworkPhoneUrl(sessionId)} size={128} bgColor="#ffffff" fgColor="#09090b" />
            </div>
            <span style={s.qrLabel}>Scan met je telefoon</span>
            <span style={s.sessionCode}>{sessionId.replace(/^mobus-/, '')}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Active relation (user tapped a dashed line on table) ──────────────────
  if (activeRelation) {
    const tokenA = tokens.find(t => t.id === activeRelation.sourceId);
    const tokenB = tokens.find(t => t.id === activeRelation.targetId);

    if (tokenA && tokenB) {
      const { reasons, question } = generateRelationExplanation(tokenA, tokenB);
      return (
        <div style={s.relationRoot} className="anim-fade-in">
          <WallStyles />
          <div style={s.relationCard}>
            <p style={s.relationEyebrow}>Mogelijke connectie</p>
            <div style={s.relationRow}>
              <div style={s.relationIdea}>
                {tokenA.drawingDataUrl && <img src={tokenA.drawingDataUrl} alt="" style={s.sketch} />}
                <div style={s.relationIdeaTitle}>{tokenA.ai_metadata?.title || tokenA.text}</div>
                <div style={s.relationIdeaDesc}>{tokenA.ai_metadata?.summary || tokenA.description}</div>
              </div>
              <div style={s.plusSign}>+</div>
              <div style={s.relationIdea}>
                {tokenB.drawingDataUrl && <img src={tokenB.drawingDataUrl} alt="" style={s.sketch} />}
                <div style={s.relationIdeaTitle}>{tokenB.ai_metadata?.title || tokenB.text}</div>
                <div style={s.relationIdeaDesc}>{tokenB.ai_metadata?.summary || tokenB.description}</div>
              </div>
            </div>
            <div style={s.reasonsBlock}>
              <p style={s.reasonsIntro}>Sluiten op elkaar aan omdat:</p>
              <ul style={s.reasonsList}>
                {reasons.map((r, i) => (
                  <li key={i} style={s.reasonItem}><span style={s.bullet}>•</span><span>{renderReason(r)}</span></li>
                ))}
              </ul>
            </div>
            <div style={s.questionBlock}>
              <p style={s.questionLabel}>Vraag voor de groep</p>
              <p style={s.questionText}>{question}</p>
            </div>
          </div>
        </div>
      );
    }
  }

  // ── Live session: two-column layout ──────────────────────────────────────
  return (
    <div style={s.root} className="anim-fade-in">
      <WallStyles />
      <div style={s.layout}>

        {/* Left strip: session + thinking indicator */}
        <aside style={s.sidebar}>
          <div style={s.sidebarInner}>
            <p style={s.sidebarEyebrow}>MOBUS</p>
            <div style={s.qrWrap}>
              <QRCodeSVG value={getNetworkPhoneUrl(sessionId)} size={80} bgColor="#ffffff" fgColor="#09090b" />
            </div>
            <span style={s.sidebarSessionCode}>{sessionId.replace(/^mobus-/, '')}</span>

            <div style={{ ...s.thinkingBadge, opacity: isThinking ? 1 : 0.4 }}>
              <span style={isThinking ? s.dotActive : s.dotIdle} className={isThinking ? 'pulse-dot' : ''} />
              <span style={s.thinkingText}>{isThinking ? 'observeert…' : 'stand-by'}</span>
            </div>

            <div style={s.tokenCount}>
              <span style={s.tokenCountNum}>{tokens.length}</span>
              <span style={s.tokenCountLabel}>{tokens.length === 1 ? 'idee' : 'ideeën'}</span>
            </div>
          </div>
        </aside>

        {/* Main: live reflection panel */}
        <main style={s.main}>
          <LiveReflection state={wallState} firestoreInsight={firestoreInsight} />
        </main>

      </div>
    </div>
  );
}

// ── Live Reflection Panel ────────────────────────────────────────────────────
function LiveReflection({
  state,
  firestoreInsight,
}: {
  state: WallState;
  firestoreInsight: { state: string; title: string; message: string; themeLabel?: string } | null;
}) {
  const [displayState, setDisplayState] = useState(state);
  const [visible, setVisible] = useState(true);

  // Fade between state transitions
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      setDisplayState(state);
      setVisible(true);
    }, 300);
    return () => clearTimeout(t);
  }, [state.type, state.label, state.ideaA]);

  const { type, label, ideaA, ideaB, count } = displayState;

  // If Firestore AI insight is active and non-standby, prefer its message
  const useFirestore = firestoreInsight && firestoreInsight.state !== 'standby'
    && (type === 'ai_suggestion' || type === 'user_group');

  const config: Record<WallStateType, { eyebrow: string; title: string; body: string; accent: string }> = {
    standby: {
      eyebrow: 'Tafel actief',
      title: 'Beweeg ideeën om patronen te vormen.',
      body: 'Breng tokens dicht bij elkaar. MOBUS observeert stille verbanden.',
      accent: '#a1a1aa',
    },
    emerging: {
      eyebrow: 'Er ontstaat iets',
      title: 'Er groeit een mogelijke richting…',
      body: 'Ideeën bewegen naar elkaar toe. Blijf ze bewegen om te zien wat verbindt.',
      accent: '#6366f1',
    },
    user_group: {
      eyebrow: 'Jullie hebben een groep gevormd',
      title: 'Wat verbindt deze ideeën?',
      body: useFirestore
        ? firestoreInsight!.message
        : `Jullie hebben ${count ?? 'meerdere'} ideeën samengebracht. Welk gedeeld verlangen of probleem zit hieronder?`,
      accent: '#09090b',
    },
    ai_suggestion: {
      eyebrow: 'AI ziet een verband',
      title: useFirestore ? firestoreInsight!.title : 'Mogelijke relatie',
      body: useFirestore
        ? firestoreInsight!.message
        : (ideaA && ideaB ? `AI ziet een mogelijke relatie tussen "${ideaA}" en "${ideaB}".` : 'AI ziet een mogelijke relatie tussen twee ideeën op de tafel.'),
      accent: '#10b981',
    },
    tension: {
      eyebrow: 'Interessante spanning',
      title: ideaA && ideaB
        ? `"${ideaA}" vs. "${ideaB}"`
        : 'Deze ideeën botsen interessant.',
      body: 'Jullie hebben ideeën met tegengestelde perspectieven samengebracht. Welke spanning zit er tussen de technische en menselijke kant?',
      accent: '#f59e0b',
    },
    naming: {
      eyebrow: 'Mogelijke naam voor deze groep',
      title: label ?? 'Jullie groep heeft een thema.',
      body: `${count ?? 'Deze'} ideeën lijken samen iets te zeggen. Hoe zouden jullie deze groep noemen?`,
      accent: '#8b5cf6',
    },
  };

  const { eyebrow, title, body, accent } = config[type];

  return (
    <div
      style={{
        ...s.reflectionPanel,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <p style={{ ...s.reflectionEyebrow, color: accent }}>{eyebrow}</p>
      <h2 style={s.reflectionTitle}>{title}</h2>
      <p style={s.reflectionBody}>{body}</p>

      {type === 'standby' && (
        <div style={s.standbyHint}>
          <span style={s.standbyDot} />
          <span style={s.standbyHintText}>Wacht op beweging op de tafel</span>
        </div>
      )}
    </div>
  );
}

// ── Injected CSS ─────────────────────────────────────────────────────────────
function WallStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }

      .anim-fade-in { animation: wallFadeIn 0.5s ease-out forwards; }
      @keyframes wallFadeIn { from { opacity: 0; } to { opacity: 1; } }

      .pulse-dot { animation: pulseDot 1.4s infinite ease-in-out; }
      @keyframes pulseDot {
        0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
        60%       { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
      }
    `}</style>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  // Root
  root: {
    width: '100vw', height: '100vh',
    backgroundColor: '#f4f4f5',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#09090b',
    overflow: 'hidden',
  },
  layout: {
    width: '100%', height: '100%',
    display: 'flex',
  },

  // Sidebar
  sidebar: {
    width: '200px',
    flexShrink: 0,
    borderRight: '1px solid #e4e4e7',
    backgroundColor: '#ffffff',
    padding: '2rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarInner: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem',
  },
  sidebarEyebrow: {
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
    color: '#a1a1aa', textTransform: 'uppercase', margin: 0,
  },
  sidebarSessionCode: {
    fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace',
    color: '#09090b', letterSpacing: '0.05em', lineHeight: 1,
  },
  thinkingBadge: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7',
    borderRadius: 99, padding: '0.3rem 0.7rem',
    transition: 'opacity 0.4s ease',
  },
  dotActive: {
    width: 8, height: 8, borderRadius: '50%',
    backgroundColor: '#6366f1', display: 'inline-block',
  },
  dotIdle: {
    width: 8, height: 8, borderRadius: '50%',
    backgroundColor: '#d4d4d8', display: 'inline-block',
  },
  thinkingText: {
    fontSize: '0.7rem', fontWeight: 600, color: '#52525b',
  },
  tokenCount: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
    marginTop: 'auto',
  },
  tokenCountNum: {
    fontSize: '2.5rem', fontWeight: 800, color: '#09090b', lineHeight: 1,
  },
  tokenCountLabel: {
    fontSize: '0.7rem', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em',
  },

  // Main reflection
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 5rem',
  },
  reflectionPanel: {
    maxWidth: '680px',
    width: '100%',
    padding: '3rem 3.5rem',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  },
  reflectionEyebrow: {
    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', margin: 0,
  },
  reflectionTitle: {
    fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.2,
    letterSpacing: '-0.02em', color: '#09090b', margin: 0,
  },
  reflectionBody: {
    fontSize: '1.15rem', fontWeight: 400, color: '#52525b',
    lineHeight: 1.65, margin: 0,
  },
  standbyHint: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem',
  },
  standbyDot: {
    width: 6, height: 6, borderRadius: '50%',
    backgroundColor: '#d4d4d8', display: 'inline-block',
    animation: 'none',
  },
  standbyHintText: {
    fontSize: '0.8rem', color: '#a1a1aa', fontStyle: 'italic',
  },

  // Landing (no ideas)
  landingRoot: {
    width: '100vw', height: '100vh',
    backgroundColor: '#f4f4f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#09090b',
  },
  landingInner: {
    display: 'flex', alignItems: 'center', gap: '4rem',
    backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7',
    borderRadius: 8, padding: '3.5rem 4rem',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
  },
  landingLeft: {
    display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 340,
  },
  landingEyebrow: {
    fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
    color: '#a1a1aa', textTransform: 'uppercase', margin: 0,
  },
  landingTitle: {
    fontSize: '3rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em',
  },
  landingSubtitle: {
    fontSize: '1.1rem', color: '#71717a', margin: 0, lineHeight: 1.6,
  },
  landingDivider: { width: 1, height: 140, backgroundColor: '#e4e4e7' },
  landingRight: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  },
  qrWrap: {
    padding: '0.5rem', backgroundColor: '#ffffff',
    border: '1px solid #e4e4e7', borderRadius: 4,
  },
  qrLabel: {
    fontSize: '0.65rem', fontWeight: 700, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  sessionCode: {
    fontSize: '3rem', fontWeight: 800, fontFamily: 'monospace',
    color: '#09090b', letterSpacing: '0.06em', lineHeight: 1,
  },

  // Active relation
  relationRoot: {
    width: '100vw', height: '100vh', backgroundColor: '#f4f4f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif", color: '#09090b',
    padding: '2rem', boxSizing: 'border-box' as const,
  },
  relationCard: {
    backgroundColor: '#ffffff', border: '2px solid #09090b',
    borderRadius: 8, padding: '3rem',
    maxWidth: 900, width: '100%', boxSizing: 'border-box' as const,
    boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column' as const, gap: '2rem',
  },
  relationEyebrow: {
    fontSize: '0.8rem', fontWeight: 700, color: '#10b981',
    textTransform: 'uppercase' as const, letterSpacing: '0.12em',
    textAlign: 'center' as const, margin: 0,
  },
  relationRow: {
    display: 'flex', alignItems: 'stretch', gap: '2rem',
  },
  relationIdea: {
    flex: 1, backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7',
    borderRadius: 6, padding: '2rem',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', textAlign: 'center' as const, gap: '0.5rem',
  },
  sketch: { width: 120, height: 90, objectFit: 'contain' as const },
  relationIdeaTitle: {
    fontSize: '1.4rem', fontWeight: 800, color: '#09090b', lineHeight: 1.2,
  },
  relationIdeaDesc: { fontSize: '0.9rem', color: '#71717a', lineHeight: 1.5 },
  plusSign: {
    fontSize: '2.5rem', fontWeight: 300, color: '#a1a1aa',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  reasonsBlock: { borderTop: '1px solid #e4e4e7', paddingTop: '1.5rem' },
  reasonsIntro: { fontSize: '1rem', fontWeight: 600, color: '#52525b', margin: '0 0 1rem 0' },
  reasonsList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  reasonItem: { display: 'flex', gap: '0.6rem', fontSize: '1.05rem', color: '#27272a', lineHeight: 1.5 },
  bullet: { color: '#10b981', fontWeight: 900 },
  questionBlock: {
    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
    borderRadius: 6, padding: '1.75rem',
  },
  questionLabel: {
    fontSize: '0.75rem', fontWeight: 700, color: '#15803d',
    textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: '0 0 0.5rem 0',
  },
  questionText: {
    fontSize: '1.35rem', fontWeight: 700, color: '#14532d', lineHeight: 1.4, margin: 0,
  },

  // Loading
  loadingRoot: {
    width: '100vw', height: '100vh', backgroundColor: '#f4f4f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  loadingText: { fontSize: '1rem', color: '#71717a' },
};
