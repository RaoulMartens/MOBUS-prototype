import { useState, useEffect } from "react";
import { db, isConfigured } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";
import { 
  Database, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Edit,
  Trash2,
  Plus,
  Wifi,
  FileText,
  ShieldAlert
} from "lucide-react";
import "./App.css";

// The 6 seed tokens with design/color properties
const SEED_TOKENS = [
  { id: "seed-01", name: "Seed 01", class: "token-seed-01" },
  { id: "seed-02", name: "Seed 02", class: "token-seed-02" },
  { id: "seed-03", name: "Seed 03", class: "token-seed-03" },
  { id: "seed-04", name: "Seed 04", class: "token-seed-04" },
  { id: "seed-05", name: "Seed 05", class: "token-seed-05" },
  { id: "seed-06", name: "Seed 06", class: "token-seed-06" },
];

function App() {
  // Simple SPA state-router using browser history
  const [isAdmin, setIsAdmin] = useState(window.location.pathname === "/admin");

  // Shared state
  const [sessionId, setSessionId] = useState("mobus-001");
  const [tokensData, setTokensData] = useState({}); // Real-time document values from Firestore
  const [dbError, setDbError] = useState(null);

  // Phone flow state
  const [userStep, setUserStep] = useState("session"); // 'session' | 'idea' | 'token' | 'submitting' | 'success'
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [selectedToken, setSelectedToken] = useState("");

  // Admin page state
  const [tempSessionId, setTempSessionId] = useState("mobus-001");
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false); // true if editing existing
  
  // Admin form state
  const [formTokenId, setFormTokenId] = useState("seed-01");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  // Sync route state with history popstate (browser back/forward)
  useEffect(() => {
    const handleLocationChange = () => {
      setIsAdmin(window.location.pathname === "/admin");
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  // Update HTML body class dynamically for responsive layout adjustment
  useEffect(() => {
    if (isAdmin) {
      document.body.classList.add("admin-route");
    } else {
      document.body.classList.remove("admin-route");
    }
  }, [isAdmin]);

  // Navigate utility
  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    setIsAdmin(path === "/admin");
    setAdminSuccess(null);
    setAdminError(null);
  };

  // Real-time snapshot listener on the current session tokens
  useEffect(() => {
    if (!isConfigured || !sessionId) return;

    setDbError(null);
    const tokensCollectionRef = collection(db, "sessions", sessionId, "tokens");
    
    // Listen to changes in real-time
    const unsubscribe = onSnapshot(
      tokensCollectionRef, 
      (snapshot) => {
        const data = {};
        snapshot.forEach((doc) => {
          data[doc.id] = doc.data();
        });
        setTokensData(data);
      },
      (err) => {
        console.error("Firestore sync error:", err);
        setDbError(`Fout bij laden van database updates: ${err.message}`);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  // Check helper functions
  const isTokenOccupied = (tokenId) => {
    return !!tokensData[tokenId];
  };

  const isTokenFree = (tokenId) => {
    return !isTokenOccupied(tokenId);
  };

  // ==========================================
  // PHONE FLOW OPERATIONS
  // ==========================================
  const handleUserSubmit = async () => {
    if (!isConfigured) {
      setDbError("Firebase is niet geconfigureerd. Voeg je credentials toe.");
      return;
    }

    setUserStep("submitting");
    setDbError(null);

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", selectedToken);
      
      const payload = {
        tokenId: selectedToken,
        title: ideaTitle.trim(),
        description: ideaDescription.trim(),
        status: "active",
        source: "phone",
        cluster: null,
        position: { x: null, y: null },
        priority: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(docRef, payload, { merge: true });
      setUserStep("success");
    } catch (err) {
      console.error("User save failed:", err);
      setDbError(`Opslaan mislukt: ${err.message}`);
      setUserStep("token");
    }
  };

  const handleAddAnotherIdea = () => {
    setIdeaTitle("");
    setIdeaDescription("");
    setSelectedToken("");
    setDbError(null);
    setUserStep("idea");
  };

  // ==========================================
  // ADMIN ENVIRONMENT OPERATIONS
  // ==========================================
  const handleLoadSession = () => {
    if (!tempSessionId.trim()) return;
    setSessionId(tempSessionId.trim());
    setAdminSuccess(`Sessie '${tempSessionId}' geladen.`);
    setTimeout(() => setAdminSuccess(null), 3000);
  };

  const handleEditClick = (token) => {
    setIsEditing(true);
    setFormTokenId(token.tokenId);
    setFormTitle(token.title || "");
    setFormDescription(token.description || "");
    setFormStatus(token.status || "active");
    setAdminError(null);
    setAdminSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    resetAdminForm();
  };

  const resetAdminForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStatus("active");
    setIsEditing(false);
  };

  const handleAdminSave = async (e) => {
    e.preventDefault();
    if (!isConfigured) {
      setAdminError("Firebase is niet geconfigureerd.");
      return;
    }
    if (!formTitle.trim()) {
      setAdminError("Voer een titel in.");
      return;
    }

    setAdminError(null);
    setAdminSuccess(null);

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", formTokenId);
      
      const existingDoc = tokensData[formTokenId];
      
      const payload = {
        tokenId: formTokenId,
        title: formTitle.trim(),
        description: formDescription.trim(),
        status: formStatus,
        source: "admin",
        updatedAt: serverTimestamp()
      };

      // Set creation date if it's a new entry
      if (!existingDoc || !isEditing) {
        payload.createdAt = serverTimestamp();
        payload.cluster = null;
        payload.position = { x: null, y: null };
        payload.priority = null;
      }

      await setDoc(docRef, payload, { merge: true });
      setAdminSuccess(
        isEditing 
          ? `Idee op ${formTokenId} succesvol bijgewerkt.` 
          : `Nieuw idee op ${formTokenId} succesvol opgeslagen.`
      );
      resetAdminForm();
    } catch (err) {
      console.error("Admin save error:", err);
      setAdminError(`Opslaan mislukt: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (tokenId) => {
    if (!isConfigured) return;
    if (!window.confirm(`Weet je zeker dat je het idee op ${tokenId} permanent wilt verwijderen uit de database?`)) {
      return;
    }
    try {
      setAdminError(null);
      const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
      await deleteDoc(docRef);
      setAdminSuccess(`Token ${tokenId} permanent verwijderd.`);
    } catch (err) {
      setAdminError(`Verwijderen mislukt: ${err.message}`);
    }
  };

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="logo-section">
          <h1 className="app-title" onClick={() => navigateTo("/")} style={{ cursor: "pointer" }}>
            <Sparkles size={20} color="#6366f1" />
            MOBUS
          </h1>
          <span className="app-subtitle">
            {isAdmin ? "Beheeromgeving (Admin)" : "Seed Input Screen"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {isAdmin ? (
            <button className="reset-session-btn" onClick={() => navigateTo("/")} style={{ textDecoration: "none", fontWeight: "600", color: "var(--accent)" }}>
              Gebruikersflow ➔
            </button>
          ) : (
            <button className="reset-session-btn" onClick={() => navigateTo("/admin")} style={{ textDecoration: "none", fontWeight: "600", color: "var(--accent)" }}>
              Admin ➔
            </button>
          )}
          {(!isAdmin || userStep !== "session") && (
            <div className="session-badge">{sessionId}</div>
          )}
        </div>
      </header>

      {/* RENDER ADMIN VIEW */}
      {isAdmin ? (
        <main className="admin-layout">
          {/* Admin Left Column: Token Overview & List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div className="card">
              <h2 className="card-title">Sessie Beheer</h2>
              <div className="admin-header-actions">
                <div className="input-group" style={{ flex: 1, minWidth: "200px" }}>
                  <label htmlFor="admin-session-input" className="input-label">Sessiecode</label>
                  <input
                    id="admin-session-input"
                    type="text"
                    className="text-input"
                    value={tempSessionId}
                    onChange={(e) => setTempSessionId(e.target.value)}
                    placeholder="mobus-001"
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleLoadSession}
                  style={{ width: "auto", alignSelf: "flex-end" }}
                >
                  Sessie laden
                </button>
              </div>

              {adminSuccess && (
                <div className="error-banner" style={{ backgroundColor: "var(--success-glow)", borderColor: "var(--success)" }}>
                  <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
                  <span style={{ color: "var(--text-primary)" }}>{adminSuccess}</span>
                </div>
              )}
              {adminError && (
                <div className="error-banner">
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <div className="error-title">Fout</div>
                    {adminError}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="card-title">Token Status Overzicht</h2>
              <p className="card-description">
                Hieronder zie je real-time welke van de 6 fysieke tokens bezet of vrij zijn in de sessie <strong>{sessionId}</strong>.
              </p>

              <div className="admin-card-list">
                {SEED_TOKENS.map((token) => {
                  const data = tokensData[token.id];
                  const occupied = isTokenOccupied(token.id);

                  return (
                    <div key={token.id} className="admin-token-card">
                      <div className="admin-token-header">
                        <div className="admin-token-title-row">
                          <span className={`admin-token-id-badge ${token.class}`}>
                            {token.name}
                          </span>
                          {occupied ? (
                            <span className="occ-pill occ-occupied">Bezet</span>
                          ) : (
                            <span className="occ-pill occ-free">Vrij</span>
                          )}
                        </div>
                        {occupied && (
                          <span className={`status-pill status-${data.status}`}>
                            {data.status}
                          </span>
                        )}
                      </div>

                      {occupied ? (
                        <>
                          <div>
                            <div className="admin-idea-title">{data.title}</div>
                            {data.description && (
                              <p className="admin-idea-desc">{data.description}</p>
                            )}
                          </div>
                          <div className="admin-token-meta">
                            <span>Bron: <strong>{data.source || "onbekend"}</strong></span>
                            {data.updatedAt && (
                              <span>Bijgewerkt: {new Date(data.updatedAt?.seconds * 1000).toLocaleTimeString()}</span>
                            )}
                          </div>
                          <div className="admin-actions">
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleEditClick(data)}
                            >
                              <Edit size={14} />
                              Bewerken
                            </button>
                            <button 
                              className="btn btn-danger btn-sm"
                              onClick={() => handlePermanentDelete(token.id)}
                              title="Permanent verwijderen uit database"
                            >
                              <Trash2 size={14} />
                              Verwijder
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="card-description" style={{ fontStyle: "italic" }}>Geen gekoppeld idee</span>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setIsEditing(false);
                              setFormTokenId(token.id);
                              resetAdminForm();
                            }}
                          >
                            <Plus size={14} />
                            Koppel Idee
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Admin Right Column: Form to Add/Edit */}
          <div className="admin-form-container">
            <div className="card">
              <h2 className="card-title">
                {isEditing ? `Bewerken ${formTokenId.toUpperCase()}` : "Idee Handmatig Koppelen"}
              </h2>
              <p className="card-description">
                {isEditing 
                  ? "Pas de velden aan en sla de wijzigingen op in Firestore." 
                  : "Kies een token en voeg direct een idee toe via het beheerpaneel."}
              </p>

              <form onSubmit={handleAdminSave} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="input-group">
                  <label htmlFor="form-token-select" className="input-label">Selecteer Token</label>
                  <select
                    id="form-token-select"
                    className="select-input"
                    value={formTokenId}
                    onChange={(e) => setFormTokenId(e.target.value)}
                    disabled={isEditing}
                  >
                    {SEED_TOKENS.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {isTokenOccupied(t.id) && !isEditing ? "(BEZET)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="form-title" className="input-label">Idee Titel</label>
                  <input
                    id="form-title"
                    type="text"
                    className="text-input"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Bijv. Smart whiteboard link"
                    required
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="form-desc" className="input-label">Beschrijving (Context)</label>
                  <textarea
                    id="form-desc"
                    className="text-input textarea-input"
                    style={{ minHeight: "100px" }}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Voeg optioneel details of extra context toe..."
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="form-status" className="input-label">Status</label>
                  <select
                    id="form-status"
                    className="select-input"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                  >
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="clustered">clustered</option>
                    <option value="selected">selected</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    <Database size={18} />
                    Opslaan
                  </button>
                  {isEditing && (
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleCancelEdit}
                      style={{ width: "auto" }}
                    >
                      Annuleer
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </main>
      ) : (
        /* RENDER MOBILE USER FLOW */
        <main className="screen-container">
          {dbError && (
            <div className="error-banner" style={{ marginBottom: "1rem" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <div className="error-title">Database melding</div>
                {dbError}
              </div>
            </div>
          )}

          {/* Step 1: Session Setup Screen */}
          {userStep === "session" && (
            <div className="card">
              <h2 className="card-title">MOBUS Seed Input</h2>
              <p className="card-description">
                Vul de sessiecode in die getoond wordt op het hoofdscherm om de sessie te starten.
              </p>

              <div className="input-group">
                <label htmlFor="session-id-input" className="input-label">Sessiecode</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <KeyRound size={18} color="#64748b" style={{ position: "absolute", left: "12px" }} />
                  <input
                    id="session-id-input"
                    type="text"
                    className="text-input"
                    style={{ width: "100%", paddingLeft: "2.5rem" }}
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="mobus-001"
                  />
                </div>
              </div>

              <button
                id="start-session-btn"
                className="btn btn-primary"
                onClick={() => setUserStep("idea")}
                disabled={!sessionId.trim()}
              >
                Start sessie
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Step 2: Idea Input Screen */}
          {userStep === "idea" && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: "auto", padding: "0.5rem" }}
                  onClick={() => setUserStep("session")}
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="card-title">Wat wil je inbrengen?</h2>
              </div>
              
              <p className="card-description">
                Voer een korte titel in en beschrijf je idee. Dit wordt gekoppeld aan de fysieke token.
              </p>

              <div className="input-group">
                <label htmlFor="idea-title" className="input-label">Titel van idee</label>
                <input
                  id="idea-title"
                  type="text"
                  className="text-input"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="Bijv. Robot als creatieve teamgenoot"
                />
              </div>

              <div className="input-group">
                <label htmlFor="idea-desc" className="input-label">Beschrijving / Context</label>
                <textarea
                  id="idea-desc"
                  className="text-input textarea-input"
                  style={{ minHeight: "100px" }}
                  value={ideaDescription}
                  onChange={(e) => setIdeaDescription(e.target.value)}
                  placeholder="Voeg eventueel context, uitleg of voorbeelden toe..."
                />
              </div>

              <button
                id="link-to-token-btn"
                className="btn btn-primary"
                onClick={() => setUserStep("token")}
                disabled={!ideaTitle.trim()}
              >
                Koppel aan seed token
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Step 3: Token Selection Screen */}
          {userStep === "token" && (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: "auto", padding: "0.5rem" }}
                  onClick={() => setUserStep("idea")}
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="card-title">Kies seed token</h2>
              </div>

              <p className="card-description">
                Selecteer een vrije token. Bezette tokens zijn rood en kunnen niet geselecteerd worden.
              </p>

              <div className="token-grid">
                {SEED_TOKENS.map((token) => {
                  const occupied = isTokenOccupied(token.id);
                  const isSelected = selectedToken === token.id;

                  return (
                    <button
                      key={token.id}
                      id={`token-btn-${token.id}`}
                      className={`token-button ${isSelected ? "selected" : ""} ${occupied ? "occupied" : ""}`}
                      onClick={() => !occupied && setSelectedToken(token.id)}
                      disabled={occupied}
                      type="button"
                    >
                      <div className={`token-indicator ${token.class}`} />
                      <span className="token-name">{token.name}</span>
                      
                      {occupied ? (
                        <span className="token-status-label token-status-occupied">Bezet</span>
                      ) : (
                        <span className="token-status-label token-status-free">Vrij</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                id="send-to-table-btn"
                className="btn btn-primary"
                onClick={handleUserSubmit}
                disabled={!selectedToken}
              >
                <Database size={18} />
                Verstuur naar tafel
              </button>
            </div>
          )}

          {/* Step 4: Submitting Load state */}
          {userStep === "submitting" && (
            <div className="card">
              <div className="loading-container">
                <div className="spinner" />
                <span className="loading-text">Idee wordt gekoppeld aan {selectedToken}...</span>
              </div>
            </div>
          )}

          {/* Step 5: Success Confirmation Screen */}
          {userStep === "success" && (
            <div className="card success-card">
              <div className="success-icon-wrapper">
                <CheckCircle2 size={36} />
              </div>
              
              <h2 className="card-title">Seed geactiveerd!</h2>
              
              <div className="success-badge">
                {selectedToken.toUpperCase()}
              </div>

              <div className="success-instruction">
                Pak nu de fysieke seed token en leg hem op de interactieve tafel.
              </div>

              <div style={{ width: "100%", margin: "0.5rem 0 1rem 0", textAlign: "left" }}>
                <div className="input-label" style={{ marginBottom: "0.25rem" }}>Gekoppeld idee:</div>
                <div style={{ fontWeight: "700", fontSize: "1rem", color: "var(--text-primary)" }}>{ideaTitle}</div>
                {ideaDescription && (
                  <p className="idea-preview" style={{ marginTop: "0.25rem", fontStyle: "normal" }}>
                    {ideaDescription}
                  </p>
                )}
              </div>

              <button
                id="add-another-idea-btn"
                className="btn btn-primary"
                onClick={handleAddAnotherIdea}
              >
                <RefreshCw size={18} />
                Nog een idee toevoegen
              </button>
            </div>
          )}
        </main>
      )}

      {/* FOOTER & NAVIGATION PROGRESS */}
      <footer className="app-footer">
        {isAdmin ? (
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Wifi size={14} color="var(--success)" />
            Real-time Firestore Sync Actief
          </div>
        ) : (
          <div className="progress-dots">
            <div className={`dot ${userStep === "session" ? "active" : ""}`} />
            <div className={`dot ${userStep === "idea" ? "active" : ""}`} />
            <div className={`dot ${userStep === "token" || userStep === "submitting" ? "active" : ""}`} />
            <div className={`dot ${userStep === "success" ? "active" : ""}`} />
          </div>
        )}

        {isAdmin ? (
          <button 
            className="reset-session-btn"
            onClick={() => navigateTo("/")}
          >
            Naar gebruikersflow
          </button>
        ) : (
          userStep !== "session" && (
            <button 
              className="reset-session-btn" 
              onClick={() => {
                setUserStep("session");
                setIdeaTitle("");
                setIdeaDescription("");
                setSelectedToken("");
              }}
            >
              Wissel van sessie
            </button>
          )
        )}
      </footer>

      {/* DEBUG INFORMATION CONSOLE */}
      <section className="debug-section">
        <div className="debug-title">
          <span>Firestore Debug Console</span>
          {!isConfigured && (
            <span style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <ShieldAlert size={12} />
              Geen verbinding
            </span>
          )}
        </div>
        <div>
          <div>Huidig database pad: <strong className="debug-path">sessions/{sessionId}/tokens</strong></div>
          <div>Verbindingsstatus: <strong>{isConfigured ? "Geactiveerd" : "Niet Geconfigureerd"}</strong></div>
          <div>Aantal tokens ingeladen: <strong>{Object.keys(tokensData).length}</strong></div>
        </div>
      </section>
    </div>
  );
}

export default App;
