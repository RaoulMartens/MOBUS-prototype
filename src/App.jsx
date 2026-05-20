import { useState, useEffect, useRef } from "react";
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
  ShieldAlert,
  Settings,
  Palette
} from "lucide-react";
import "./App.css";

// Scalable token configuration
const TOKEN_COUNT = 30;

const generateTokens = (count) => {
  const tokens = [];
  for (let i = 1; i <= count; i++) {
    const pad = String(i).padStart(3, "0");
    const id = `seed-${pad}`;
    // Cycle through the 6 color classes defined in App.css
    const colorIndex = String(((i - 1) % 6) + 1).padStart(2, "0");
    tokens.push({
      id,
      name: `Seed ${pad}`,
      class: `token-seed-${colorIndex}`
    });
  }
  return tokens;
};

const SEED_TOKENS = generateTokens(TOKEN_COUNT);

// ==========================================
// SKETCHPAD SUB-COMPONENT (HTML5 CANVAS)
// ==========================================
function SketchPad({ canvasRef, initialSketch, onDrawStart, onClear }) {
  const isDrawingRef = useRef(false);
  const contextRef = useRef(null);
  const brushSize = 4; // Standard brush thickness
  const [brushColor, setBrushColor] = useState("#ffffff"); // Default white brush for dark canvas

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make canvas size match container bounding rectangle
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 400;
    canvas.height = rect.height || 220;

    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Load initial drawing if returning from another step
    if (initialSketch) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = initialSketch;
    }

    // Handle viewport resize: preserves drawing by drawing to virtual copy first
    const handleResize = () => {
      const tempImage = canvas.toDataURL();
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width || 400;
      canvas.height = r.height || 220;
      
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = tempImage;
      
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = brushColor;
      context.lineWidth = brushSize;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initialSketch]);

  // Sync state modifications with 2D Context
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor, brushSize]);

  // Translate client mouse/touch coordinates relative to canvas boundaries
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices (first pointer location)
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    // Support mouse pointer
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    isDrawingRef.current = true;
    if (onDrawStart) onDrawStart();
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (onClear) onClear();
  };

  return (
    <div className="sketch-section">
      <div className="canvas-header">
        <span className="input-label">
          Schets
        </span>
        <button type="button" className="btn-remove-sketch" style={{ position: "static", padding: "0.25rem 0.5rem" }} onClick={clearCanvas}>
          Wis
        </button>
      </div>
      
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          className="sketch-canvas"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      
      <div className="sketch-toolbar">
        <div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Kleur:</span>
        </div>
        
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {["#ffffff", "#000000", "#ff0000", "#00ff00", "#0000ff"].map((color) => (
            <div
              key={color}
              className={`brush-color-dot ${brushColor === color ? "active" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => setBrushColor(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
function App() {
  // Show debug console only if ?debug=true query parameter is present
  const showDebug = new URLSearchParams(window.location.search).get("debug") === "true";

  // App structure state: 'session' | 'hub'
  const [step, setStep] = useState(
    window.location.pathname === "/admin" ? "hub" : "session"
  );
  // Active Tab inside Session Hub: 'input' (Mobile Wizard) | 'manage' (Desktop Overview/Admin)
  const [activeTab, setActiveTab] = useState(
    window.location.pathname === "/admin" ? "manage" : "input"
  );

  // Connection parameters
  const [sessionId, setSessionId] = useState("mobus-001");
  const [tokensData, setTokensData] = useState({}); 
  const [dbError, setDbError] = useState(null);

  // --- TAB A: NEW IDEA WIZARD STATE ---
  const [userWizardStep, setUserWizardStep] = useState("idea");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  
  // Sketching controls
  const canvasRef = useRef(null);
  const [hasSketch, setHasSketch] = useState(false);
  const [sketchDataUrl, setSketchDataUrl] = useState(null);

  const [selectedToken, setSelectedToken] = useState("");

  // --- TAB B: ADMIN / MANAGE STATE ---
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formTokenId, setFormTokenId] = useState("seed-001");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSketch, setFormSketch] = useState(null);
  const [formStatus, setFormStatus] = useState("active");

  // Sync route and tabs with browser back/forward buttons
  useEffect(() => {
    const handleLocationChange = () => {
      const isAdminPath = window.location.pathname === "/admin";
      if (isAdminPath) {
        setStep("hub");
        setActiveTab("manage");
      } else {
        setActiveTab("input");
      }
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  // Update layout constraints dynamically based on active view mode
  useEffect(() => {
    if (step === "hub" && activeTab === "manage") {
      document.body.classList.add("admin-route");
    } else {
      document.body.classList.remove("admin-route");
    }
  }, [step, activeTab]);

  // Tab change handler with URL history tracking
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setAdminSuccess(null);
    setAdminError(null);
    if (tab === "manage") {
      window.history.pushState({}, "", "/admin");
    } else {
      window.history.pushState({}, "", "/");
    }
  };

  // Real-time snapshot synchronization with Firestore tokens collection
  useEffect(() => {
    if (!isConfigured || !sessionId) return;

    setDbError(null);
    const tokensCollectionRef = collection(db, "sessions", sessionId, "tokens");
    
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
  }, [sessionId, isConfigured]);

  const isTokenOccupied = (tokenId) => {
    const doc = tokensData[tokenId];
    return !!doc && ["draft", "active", "clustered", "selected"].includes(doc.status);
  };

  const isTokenFree = (tokenId) => {
    const doc = tokensData[tokenId];
    return !doc || doc.status === "archived";
  };

  const getFirstFreeTokenId = () => {
    const freeToken = SEED_TOKENS.find(token => isTokenFree(token.id));
    return freeToken ? freeToken.id : null;
  };

  // ==========================================
  // MOBILE USER FLOW (TAB A)
  // ==========================================
  const handleUserSubmit = async () => {
    if (!isConfigured) {
      setDbError("Firebase is niet geconfigureerd. Voeg je credentials toe.");
      return;
    }

    const firstFreeToken = getFirstFreeTokenId();
    if (!firstFreeToken) {
      setDbError("Alle seed tokens zijn in gebruik. Archiveer een seed in de beheeromgeving of start een nieuwe sessie.");
      return;
    }

    // Export the sketch from canvas before submitting
    let currentSketchDataUrl = sketchDataUrl;
    if (hasSketch && canvasRef.current) {
      try {
        currentSketchDataUrl = canvasRef.current.toDataURL("image/png");
        setSketchDataUrl(currentSketchDataUrl);
      } catch (e) {
        console.error("Error exporting canvas sketch:", e);
      }
    }

    setUserWizardStep("submitting");
    setDbError(null);

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", firstFreeToken);
      
      const payload = {
        tokenId: firstFreeToken,
        title: ideaTitle.trim(),
        description: ideaDescription.trim(),
        sketch: currentSketchDataUrl || null,
        status: "active",
        source: "phone",
        cluster: null,
        position: { x: null, y: null },
        priority: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(docRef, payload, { merge: true });
      setSelectedToken(firstFreeToken);
      setUserWizardStep("success");
    } catch (err) {
      console.error("User save failed:", err);
      setDbError(`Opslaan mislukt: ${err.message}`);
      setUserWizardStep("idea");
    }
  };

  const handleAddAnotherIdea = () => {
    setIdeaTitle("");
    setIdeaDescription("");
    setHasSketch(false);
    setSketchDataUrl(null);
    setSelectedToken("");
    setDbError(null);
    setUserWizardStep("idea");
  };

  const handleGoToManage = () => {
    setIdeaTitle("");
    setIdeaDescription("");
    setHasSketch(false);
    setSketchDataUrl(null);
    setSelectedToken("");
    setDbError(null);
    setUserWizardStep("idea");
    handleTabChange("manage");
  };

  // ==========================================
  // MANAGEMENT FLOW (TAB B)
  // ==========================================
  const handleEditClick = (token) => {
    setIsEditing(true);
    setFormTokenId(token.tokenId);
    setFormTitle(token.title || "");
    setFormDescription(token.description || "");
    setFormSketch(token.sketch || null);
    setFormStatus(token.status || "active");
    setAdminError(null);
    setAdminSuccess(null);
  };

  const handleCancelEdit = () => {
    resetAdminForm();
  };

  const resetAdminForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormSketch(null);
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
        sketch: formSketch, // Preserved or cleared sketch
        status: formStatus,
        source: "admin",
        updatedAt: serverTimestamp()
      };

      if (!existingDoc || !isEditing) {
        payload.createdAt = serverTimestamp();
        payload.cluster = null;
        payload.position = { x: null, y: null };
        payload.priority = null;
      }

      await setDoc(docRef, payload, { merge: true });
      setAdminSuccess(
        isEditing 
          ? `Idee op ${formTokenId.toUpperCase()} succesvol bijgewerkt.` 
          : `Nieuw idee op ${formTokenId.toUpperCase()} succesvol gekoppeld.`
      );
      resetAdminForm();
    } catch (err) {
      console.error("Admin save error:", err);
      setAdminError(`Opslaan mislukt: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (tokenId) => {
    if (!isConfigured) return;
    if (!window.confirm(`Weet je zeker dat je het idee op ${tokenId.toUpperCase()} permanent wilt verwijderen?`)) {
      return;
    }
    try {
      setAdminError(null);
      const docRef = doc(db, "sessions", sessionId, "tokens", tokenId);
      await deleteDoc(docRef);
      setAdminSuccess(`Token ${tokenId.toUpperCase()} permanent verwijderd. Dit seed is weer vrij.`);
    } catch (err) {
      setAdminError(`Verwijderen mislukt: ${err.message}`);
    }
  };

  const handleExitSession = () => {
    setSessionId("mobus-001");
    handleAddAnotherIdea();
    setStep("session");
    window.history.pushState({}, "", "/");
  };

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="logo-section">
          <h1 className="app-title" onClick={handleExitSession} style={{ cursor: "pointer" }} title="Terug naar startscherm">
            <Sparkles size={20} color="#6366f1" />
            MOBUS
          </h1>
          <span className="app-subtitle">Interactive Session Hub</span>
        </div>
        {step === "hub" && (
          <div className="session-badge">{sessionId}</div>
        )}
      </header>

      {/* START SCREEN: ENTER SESSION CODE */}
      {step === "session" && (
        <main className="screen-container">
          <div className="card">
            <h2 className="card-title">MOBUS Seed Input</h2>
            <p className="card-description">
              Voer de actieve sessiecode in om deel te nemen en ideeën toe te voegen of te beheren.
            </p>

            {!isConfigured && (
              <div className="error-banner">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <div className="error-title">Firebase Config Alert</div>
                  Firebase is nog niet geconfigureerd. Je kan de UI testen, maar database opslag is inactief. Configureer `.env` of `src/firebase.js`.
                </div>
              </div>
            )}

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
              onClick={() => {
                setStep("hub");
                setActiveTab("input");
                window.history.pushState({}, "", "/");
              }}
              disabled={!sessionId.trim()}
            >
              Start sessie
              <ArrowRight size={18} />
            </button>
          </div>
        </main>
      )}

      {/* SESSION HUB CONTAINER */}
      {step === "hub" && (
        <>
          {/* TAB BAR NAVIGATION */}
          <nav className="tab-navigation">
            <button
              className={`tab-btn ${activeTab === "input" ? "active" : ""}`}
              onClick={() => handleTabChange("input")}
            >
              <Plus size={16} className="tab-btn-icon" />
              Nieuw Idee
            </button>
            <button
              className={`tab-btn ${activeTab === "manage" ? "active" : ""}`}
              onClick={() => handleTabChange("manage")}
            >
              <Settings size={16} className="tab-btn-icon" />
              Beheer & Overzicht
            </button>
          </nav>

          {dbError && (
            <div className="error-banner" style={{ marginBottom: "1.5rem" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <div>
                <div className="error-title">Database fout</div>
                {dbError}
              </div>
            </div>
          )}

          {/* TAB CONTENT: A. NEW IDEA WIZARD (MOBILE FLOW WITH SKETCHPAD) */}
          {activeTab === "input" && (
            <main className="screen-container">
              {/* Wizard Step 1: Input Form */}
              {userWizardStep === "idea" && (
                <div className="card">
                  <h2 className="card-title">Wat wil je inbrengen?</h2>
                  <p className="card-description">
                    Voer een korte titel in en beschrijf je idee. Je kan optioneel een schets toevoegen.
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
                      style={{ minHeight: "80px" }}
                      value={ideaDescription}
                      onChange={(e) => setIdeaDescription(e.target.value)}
                      placeholder="Voeg optioneel context of voorbeelden toe..."
                    />
                  </div>

                  {/* DRAWING CANVAS SECTION */}
                  <SketchPad
                    canvasRef={canvasRef}
                    initialSketch={sketchDataUrl}
                    onDrawStart={() => setHasSketch(true)}
                    onClear={() => {
                      setHasSketch(false);
                      setSketchDataUrl(null);
                    }}
                  />

                  {/* Availability indicator & Warning if all occupied */}
                  {getFirstFreeTokenId() === null ? (
                    <div className="error-banner" style={{ marginTop: "0.5rem" }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <div>
                        Alle seed tokens zijn in gebruik. Archiveer een seed in de beheeromgeving of start een nieuwe sessie.
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: "500", marginTop: "0.5rem" }}>
                      Beschikbare seed tokens: {SEED_TOKENS.filter(t => isTokenFree(t.id)).length} van {TOKEN_COUNT}
                    </div>
                  )}

                  <button
                    id="send-to-table-btn"
                    className="btn btn-primary"
                    onClick={handleUserSubmit}
                    disabled={!ideaTitle.trim() || getFirstFreeTokenId() === null}
                    style={{ marginTop: "0.5rem" }}
                  >
                    <Database size={18} />
                    Verstuur naar tafel
                  </button>
                </div>
              )}

              {/* Wizard Step 3: Loading Submitting */}
              {userWizardStep === "submitting" && (
                <div className="card">
                  <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Idee wordt gekoppeld aan {selectedToken.toUpperCase()}...</span>
                  </div>
                </div>
              )}

              {/* Wizard Step 4: Success Confirmation */}
              {userWizardStep === "success" && (() => {
                const padNum = selectedToken ? selectedToken.split("-")[1] : "";
                const formattedTokenName = `Seed ${padNum}`;
                return (
                  <div className="card success-card">
                    <div className="success-icon-wrapper">
                      <CheckCircle2 size={36} />
                    </div>
                    
                    <h2 className="card-title">{formattedTokenName} is geactiveerd</h2>
                    
                    <div className="success-badge">
                      {selectedToken.toUpperCase()}
                    </div>

                    <div className="success-instruction">
                      Pak de fysieke {formattedTokenName} en leg hem op de interactieve tafel.
                    </div>

                    <div style={{ width: "100%", margin: "0.5rem 0 1rem 0", textAlign: "left" }}>
                      <div className="input-label" style={{ marginBottom: "0.25rem" }}>Gekoppeld idee:</div>
                      <div style={{ fontWeight: "700", fontSize: "1rem", color: "var(--text-primary)" }}>{ideaTitle}</div>
                      {ideaDescription && (
                        <p className="idea-preview" style={{ marginTop: "0.25rem", fontStyle: "normal" }}>
                          {ideaDescription}
                        </p>
                      )}
                      {sketchDataUrl && (
                        <div className="sketch-thumbnail-container" style={{ width: "100%", marginTop: "0.5rem" }}>
                          <img src={sketchDataUrl} className="sketch-thumbnail-img" alt="Activated sketch" />
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
                      <button
                        id="add-another-idea-btn"
                        className="btn btn-primary"
                        onClick={handleAddAnotherIdea}
                      >
                        <RefreshCw size={18} />
                        Nog een idee toevoegen
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleGoToManage}
                      >
                        <Settings size={18} />
                        Ga naar ideeënbeheer
                      </button>
                    </div>
                  </div>
                );
              })()}
            </main>
          )}

          {/* TAB CONTENT: B. MANAGEMENT / ADMIN DASHBOARD */}
          {activeTab === "manage" && (
            <main className="admin-layout">
              {/* Left Column: Token List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="card" style={{ paddingBottom: "1.25rem" }}>
                  <h2 className="card-title">Token Status Overzicht</h2>
                  <p className="card-description">
                    Hieronder zie je real-time welke van de {TOKEN_COUNT} fysieke tokens in sessie <strong>{sessionId}</strong> bezet of vrij zijn.
                  </p>
                  <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: "500", marginTop: "0.5rem" }}>
                    Volgende automatisch gekozen token: <strong style={{ color: "var(--accent)" }}>{getFirstFreeTokenId() ? `Seed ${getFirstFreeTokenId().split("-")[1]}` : "Geen (alle tokens bezet)"}</strong>
                  </div>
                  
                  {adminSuccess && (
                    <div className="error-banner" style={{ backgroundColor: "var(--success-glow)", borderColor: "var(--success)", marginTop: "1rem" }}>
                      <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
                      <span style={{ color: "var(--text-primary)" }}>{adminSuccess}</span>
                    </div>
                  )}
                  {adminError && (
                    <div className="error-banner" style={{ marginTop: "1rem" }}>
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <div>
                        <div className="error-title">Fout</div>
                        {adminError}
                      </div>
                    </div>
                  )}
                </div>

                <div className="admin-card-list">
                  {SEED_TOKENS.map((token) => {
                    const data = tokensData[token.id];
                    const hasDoc = !!data;
                    const occupied = isTokenOccupied(token.id);
                    const isNextFree = token.id === getFirstFreeTokenId();

                    return (
                      <div 
                        key={token.id} 
                        className="admin-token-card"
                        style={isNextFree ? { border: "2px solid var(--accent)", boxShadow: "0 0 10px var(--accent-glow)" } : {}}
                      >
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
                            {isNextFree && (
                              <span className="occ-pill" style={{ backgroundColor: "rgba(99, 102, 241, 0.2)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                                Volgende
                              </span>
                            )}
                          </div>
                          {hasDoc && (
                            <span className={`status-pill status-${data.status}`}>
                              {data.status}
                            </span>
                          )}
                        </div>

                        {hasDoc ? (
                          <>
                            <div>
                              <div className="admin-idea-title">{data.title}</div>
                              {data.description && (
                                <p className="admin-idea-desc">{data.description}</p>
                              )}
                              {data.sketch && (
                                <div className="sketch-thumbnail-container">
                                  <img src={data.sketch} className="sketch-thumbnail-img" alt="Seed sketch preview" />
                                </div>
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

              {/* Right Column: Editor Form */}
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

                    {formSketch && (
                      <div className="sketch-form-preview">
                        <div className="input-label" style={{ marginBottom: "0.25rem" }}>Gekoppelde Schets</div>
                        <img src={formSketch} className="sketch-thumbnail-img" alt="Sketch edit preview" />
                        <button type="button" className="btn-remove-sketch" onClick={() => setFormSketch(null)}>
                          Verwijder Schets
                        </button>
                      </div>
                    )}

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
                        <option value="archived">archived</option>
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
          )}

          {/* FOOTER BUTTONS */}
          <footer className="app-footer">
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Wifi size={14} color="var(--success)" />
              Real-time Firestore Sync Actief
            </div>

            <button 
              className="reset-session-btn" 
              onClick={handleExitSession}
            >
              Wissel van sessie
            </button>
          </footer>
        </>
      )}

      {/* DEBUG CONSOLE */}
      {showDebug && (
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div>Huidig database pad: <strong className="debug-path">sessions/{sessionId}/tokens</strong></div>
            <div>Verbindingsstatus: <strong>{isConfigured ? "Geactiveerd" : "Niet Geconfigureerd"}</strong></div>
            <div>Aantal tokens in database: <strong>{Object.keys(tokensData).length}</strong></div>
            
            <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "0.5rem", marginTop: "0.5rem" }}>
              <strong>MOBUS Token Debugging:</strong>
            </div>
            <div>TOKEN_COUNT: <strong>{TOKEN_COUNT}</strong></div>
            <div>Volgende beschikbare token: <strong style={{ color: "var(--accent)" }}>{getFirstFreeTokenId() || "Geen (alles bezet)"}</strong></div>
            
            <div>
              <div>Bezette tokens ({SEED_TOKENS.filter(t => isTokenOccupied(t.id)).length}):</div>
              <div style={{ color: "#fca5a5", wordBreak: "break-all" }}>
                {SEED_TOKENS.filter(t => isTokenOccupied(t.id)).map(t => t.id).join(", ") || "Geen"}
              </div>
            </div>

            <div>
              <div>Vrije tokens ({SEED_TOKENS.filter(t => isTokenFree(t.id)).length}):</div>
              <div style={{ color: "#a7f3d0", wordBreak: "break-all" }}>
                {SEED_TOKENS.filter(t => isTokenFree(t.id)).map(t => t.id).join(", ") || "Geen"}
              </div>
            </div>

            <div>
              <div>Alle tokenIds ({SEED_TOKENS.length}):</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                {SEED_TOKENS.map(t => t.id).join(", ")}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
