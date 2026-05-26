import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useTokens } from '../contexts/TokenContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

export function DebugView() {
  const { sessionId } = useTokens();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "MOBUS - Debug & AI Monitor";
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);

    const ref = collection(db, "sessions", sessionId, "tokens");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        // Sort by id or createdAt
        list.sort((a, b) => b.id.localeCompare(a.id));
        setTokens(list);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore debug list failed:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  const handleReclassify = async (tokenId: string, text: string, description: string) => {
    // 1. Update status locally in Firestore to pending_classification
    const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
    try {
      await updateDoc(docRef, { status: "pending_classification" });
      
      // 2. Call local bridge classification endpoint
      const bridgeUrl = "http://localhost:8787";
      await fetch(`${bridgeUrl}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(tokenId)}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, description }),
      });
    } catch (err) {
      console.error("Reclassification trigger failed:", err);
    }
  };

  const handleToggleArchive = async (tokenId: string, currentArchived: boolean) => {
    const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
    try {
      await updateDoc(docRef, {
        archived: !currentArchived,
        status: !currentArchived ? "archived" : "active",
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to toggle archive status:", err);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!window.confirm("Weet je zeker dat je dit token definitief wilt verwijderen?")) return;
    const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
    try {
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Failed to delete token:", err);
    }
  };

  const getStatusBadge = (token: any) => {
    const status = token.status || "active";
    if (token.archived === true || status === "archived") {
      return <Badge variant="secondary" className="bg-zinc-200 border-zinc-400 text-zinc-800">Archived</Badge>;
    }
    if (status === "pending_classification") {
      return <Badge variant="default" className="bg-amber-100 border-amber-400 text-amber-800 animate-pulse">Classifying...</Badge>;
    }
    if (status === "needs_classification") {
      return <Badge variant="destructive" className="bg-red-100 border-red-400 text-red-800">Needs Classify (Error)</Badge>;
    }
    return <Badge variant="outline" className="bg-green-100 border-green-400 text-green-800">Active / Classified</Badge>;
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-zinc-950 overflow-auto font-sans text-zinc-900 dark:text-zinc-50">
      <div className="max-w-6xl mx-auto p-8 pt-16">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between border-b pb-6 border-zinc-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">AI & Metadata Monitor</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Inspecteer, beheer en herclassificeer ideeën voor actieve sessie: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-800 dark:text-zinc-200">{sessionId}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = `/table?sessionId=${sessionId}`}
              className="bg-white border-zinc-300 hover:bg-zinc-100 text-zinc-800"
            >
              Naar Tafelscherm
            </Button>
            <Button
              onClick={() => window.location.href = `/dev/wall?sessionId=${sessionId}`}
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              Naar Wandscherm
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="text-zinc-500 animate-pulse text-lg">Gegevens ophalen...</span>
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-zinc-300 dark:border-zinc-800 rounded">
            <p className="text-zinc-500 text-lg">Er zijn nog geen ideeën in deze sessie.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tokens.map((token) => {
              const originalTitle = token.text || token.title;
              return (
                <Card key={token.id} className="border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded shadow-none overflow-hidden">
                  <CardContent className="p-6">
                    
                    {/* Top Row: Info and status */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-bold">{token.ai_metadata?.title || originalTitle}</h2>
                          {getStatusBadge(token)}
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-1">ID: {token.id}</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReclassify(token.id, originalTitle, token.description || "")}
                          className="bg-white border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs"
                          disabled={token.status === "pending_classification"}
                        >
                          Herclassificeer
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleArchive(token.id, !!token.archived)}
                          className="bg-white border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs"
                        >
                          {token.archived ? "Herstel van archief" : "Archiveer"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteToken(token.id)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs"
                        >
                          Verwijder
                        </Button>
                      </div>
                    </div>

                    {/* Stored Fields Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      
                      {/* Left: Original Data */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide border-b pb-1">Origineel Ingevuld</h3>
                        <div>
                          <span className="text-xs font-semibold text-zinc-400">Originele Titel:</span>
                          <p className="text-sm font-medium mt-0.5">{originalTitle}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-zinc-400">Originele Beschrijving:</span>
                          <p className="text-sm mt-0.5 whitespace-pre-wrap">{token.description || <span className="italic text-zinc-300">Geen beschrijving ingevuld</span>}</p>
                        </div>
                        {token.sketch && (
                          <div>
                            <span className="text-xs font-semibold text-zinc-400">Teken Schets:</span>
                            <img src={token.sketch} alt="Sketch" className="h-24 object-contain mt-1 border border-zinc-200 rounded p-1" />
                          </div>
                        )}
                      </div>

                      {/* Right: AI Metadata */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide border-b pb-1">AI Metadata (Gemini)</h3>
                        {token.ai_metadata ? (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2 text-xs border-b pb-2 mb-2 border-zinc-100 dark:border-zinc-800">
                              <div>
                                <span className="font-semibold text-zinc-400">Usable Idea?</span>
                                <p className={`font-bold mt-0.5 ${token.ai_metadata.is_usable_idea ? 'text-green-600' : 'text-red-500'}`}>
                                  {token.ai_metadata.is_usable_idea ? "Ja" : "Nee"}
                                </p>
                              </div>
                              <div>
                                <span className="font-semibold text-zinc-400">Validation Status:</span>
                                <p className="font-bold mt-0.5 font-mono">{token.ai_metadata.validation_status}</p>
                              </div>
                            </div>

                            {token.ai_metadata.user_friendly_feedback && (
                              <div>
                                <span className="text-xs font-semibold text-zinc-400">Feedback:</span>
                                <p className="text-xs mt-0.5 italic text-zinc-700 dark:text-zinc-300">{token.ai_metadata.user_friendly_feedback}</p>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="font-semibold text-zinc-400">Categorie:</span>
                                <p className="font-bold mt-0.5">{token.ai_metadata.category}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-zinc-400">Perspectief:</span>
                                <p className="font-bold mt-0.5">{token.ai_metadata.perspective}</p>
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-zinc-400">AI Samenvatting:</span>
                              <p className="text-xs mt-0.5">{token.ai_metadata.summary}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-zinc-400">Creatieve Intentie:</span>
                              <p className="text-xs mt-0.5">{token.ai_metadata.creative_intent}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800">
                              <div>
                                <span className="font-semibold text-zinc-400">Betrouwbaarheid AI:</span>
                                <p className="font-bold mt-0.5">{Math.round(token.ai_metadata.confidence * 100)}%</p>
                              </div>
                              <div>
                                <span className="font-semibold text-zinc-400">Should Cluster?</span>
                                <p className="font-bold mt-0.5">{token.ai_metadata.should_cluster ? "Ja" : "Nee"}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-zinc-400">Cluster Name:</span>
                                <p className="font-bold mt-0.5">{token.ai_metadata.cluster_name || <span className="italic text-zinc-300">null</span>}</p>
                              </div>
                            </div>
                            {token.ai_metadata.tags && token.ai_metadata.tags.length > 0 && (
                              <div>
                                <span className="text-xs font-semibold text-zinc-400">Tags:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {token.ai_metadata.tags.map((tag: string, i: number) => (
                                    <span key={i} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-350 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">#{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {token.ai_metadata.possible_connections && token.ai_metadata.possible_connections.length > 0 && (
                              <div>
                                <span className="text-xs font-semibold text-zinc-400">Mogelijke Verbindingen:</span>
                                <ul className="list-disc list-inside text-xs space-y-0.5 mt-1 text-zinc-600 dark:text-zinc-400">
                                  {token.ai_metadata.possible_connections.map((conn: string, i: number) => (
                                    <li key={i}>{conn}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded text-center text-xs text-zinc-500">
                            Geen AI metadata beschikbaar. Klik op Herclassificeer om te analyseren.
                          </div>
                        )}
                      </div>

                    </div>
                    
                    {/* Raw JSON Toggle */}
                    <div className="mt-4 pt-4 border-t border-zinc-150 dark:border-zinc-850">
                      <details className="cursor-pointer group">
                        <summary className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">RAW JSON DATA</summary>
                        <pre className="mt-2 p-3 bg-zinc-950 text-emerald-400 text-[10px] font-mono rounded overflow-auto max-h-60 leading-normal">
                          {JSON.stringify(token, null, 2)}
                        </pre>
                      </details>
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
