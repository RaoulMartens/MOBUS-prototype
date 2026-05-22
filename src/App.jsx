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
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  KeyRound,
  Edit,
  Trash2,
  Plus,
  ShieldAlert,
  Settings,
  ChevronDown,
  ChevronUp,
  Pencil,
  QrCode,
  LayoutGrid
} from "lucide-react";
import "./App.css";


// ── Utility: parse the numeric part of a seed id ──
const seedNum = (id) => {
  const m = id.match(/^seed-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
};

// ==========================================
// SKETCHPAD SUB-COMPONENT (HTML5 CANVAS)
// ==========================================
function SketchPad({ canvasRef, initialSketch, onDrawStart, onClear }) {
  const isDrawingRef = useRef(false);
  const contextRef = useRef(null);
  const brushSize = 4;
  const [brushColor, setBrushColor] = useState("#ffffff");

  const brushColorRef = useRef(brushColor);
  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    contextRef.current = context;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        let tempImage = null;
        try {
          if (canvas.width > 0 && canvas.height > 0) {
            tempImage = canvas.toDataURL();
          }
        } catch (e) {
          console.error("Canvas export error on resize:", e);
        }

        canvas.width = width;
        canvas.height = height;

        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = brushColorRef.current;
        context.lineWidth = brushSize;

        if (tempImage) {
          const img = new Image();
          img.onload = () => context.drawImage(img, 0, 0);
          img.src = tempImage;
        } else if (initialSketch) {
          const img = new Image();
          img.onload = () => context.drawImage(img, 0, 0);
          img.src = initialSketch;
        }
      }
    });

    resizeObserver.observe(canvas);

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = brushColor;
    context.lineWidth = brushSize;

    if (initialSketch) {
      const img = new Image();
      img.onload = () => context.drawImage(img, 0, 0);
      img.src = initialSketch;
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [initialSketch]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

  const stopDrawing = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (onClear) onClear();
  };

  return (
    <div className="sketch-section">
      <div className="canvas-header">
        <span className="input-label">Teken je schets</span>
        <button type="button" className="btn-remove-sketch" style={{ position: "static", padding: "0.25rem 0.5rem" }} onClick={clearCanvas}>
          Wis schets
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
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Schetskleur:</span>
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
// ADMIN SEED CARD SUB-COMPONENT
// ==========================================
function AdminSeedCard({
  seedId,
  data,
  isEditing,
  formTitle,
  formDescription,
  formSketch,
  setFormTitle,
  setFormDescription,
  setFormSketch,
  onSave,
  onCancel,
  onEdit,
  onDelete
}) {
  return (
    <div className={`admin-token-card ${isEditing ? "editing-mode" : ""} ${data.sketch ? "has-sketch" : ""}`}>
      {isEditing ? (
        <form onSubmit={onSave} className="admin-edit-form-inner">
          <div className="input-group">
            <label htmlFor={`edit-title-${seedId}`} className="input-label">Titel</label>
            <input
              id={`edit-title-${seedId}`}
              type="text"
              className="text-input"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Voer een titel in..."
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor={`edit-desc-${seedId}`} className="input-label">Beschrijving</label>
            <textarea
              id={`edit-desc-${seedId}`}
              className="text-input textarea-input"
              style={{ minHeight: "100px" }}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Voeg optioneel details of context toe..."
            />
          </div>

          {formSketch && (
            <div className="sketch-form-preview" style={{ width: "100%", position: "relative" }}>
              <img src={formSketch} className="sketch-thumbnail-img" alt="Sketch preview" />
              <button type="button" className="btn-remove-sketch" onClick={() => setFormSketch(null)}>
                Verwijder schets
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", width: "100%" }}>
            <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
              Opslaan
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCancel}
              style={{ flex: 1 }}
            >
              Annuleer
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-view-card-inner">
          {/* ── Idea content ── */}
          <div className="seed-card-content">
            <div className="seed-card-title">{data.title}</div>
            {data.description && (
              <p className="seed-card-desc">{data.description}</p>
            )}
            {data.sketch && (
              <div className="sketch-thumbnail-container" style={{ marginTop: "0.5rem" }}>
                <img src={data.sketch} className="sketch-thumbnail-img" alt="Idea sketch" />
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="seed-card-actions">
            <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => onEdit(data)} style={{ flex: 1 }}>
                <Edit size={14} />
                Bewerken
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => onDelete(seedId)}
                style={{ flex: 1 }}
              >
                <Trash2 size={14} />
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================
function App() {
  const showDebug = new URLSearchParams(window.location.search).get("debug") === "true";

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname;
    if (path === "/admin" || path === "/manage") return "ideas";
    if (path === "/session") return "session";
    return "new";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevTab, setPrevTab] = useState(null);
  const [slideDirection, setSlideDirection] = useState("forward");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Scroll to top instantly to prevent layout jump while switching tabs
    window.scrollTo(0, 0);

    const timer = setTimeout(() => {
      setIsTransitioning(false);
      setPrevTab(null);
    }, 400); // 400ms matching CSS animation duration

    return () => clearTimeout(timer);
  }, [activeTab]);

  const getTabClassName = (tabName) => {
    if (tabName === activeTab) {
      return isTransitioning
        ? `tab-screen-wrapper entering dir-${slideDirection}`
        : "tab-screen-wrapper active";
    }
    if (tabName === prevTab && isTransitioning) {
      return `tab-screen-wrapper exiting dir-${slideDirection}`;
    }
    return "tab-screen-wrapper inactive";
  };

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerSuccess, setScannerSuccess] = useState(null);

  // Connection
  const [sessionId, setSessionId] = useState("mobus-001");
  const [tokensData, setTokensData] = useState({});
  const [dbError, setDbError] = useState(null);

  // --- TAB A: NEW IDEA WIZARD ---
  const [userWizardStep, setUserWizardStep] = useState("idea");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const canvasRef = useRef(null);
  const [hasSketch, setHasSketch] = useState(false);
  const [sketchDataUrl, setSketchDataUrl] = useState(null);
  const [showSketch, setShowSketch] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  // --- TAB B: ADMIN ---
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formSeedId, setFormSeedId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSketch, setFormSketch] = useState(null);
  const [formStatus, setFormStatus] = useState("active");

  // Keyboard visibility detection (on focus of inputs/textareas)
  useEffect(() => {
    const handleFocus = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setIsKeyboardVisible(true);
      }
    };
    const handleBlur = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setIsKeyboardVisible(false);
      }
    };
    window.addEventListener("focusin", handleFocus);
    window.addEventListener("focusout", handleBlur);
    return () => {
      window.removeEventListener("focusin", handleFocus);
      window.removeEventListener("focusout", handleBlur);
    };
  }, []);

  // Network connection status listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);


  // ── Routing ──
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      let targetTab = "new";
      if (path === "/admin" || path === "/manage") {
        targetTab = "ideas";
      } else if (path === "/session") {
        targetTab = "session";
      }

      if (targetTab !== activeTab) {
        const tabIndices = { new: 0, ideas: 1, session: 2 };
        const currentIndex = tabIndices[activeTab];
        const nextIndex = tabIndices[targetTab];
        const direction = nextIndex > currentIndex ? "forward" : "backward";

        setPrevTab(activeTab);
        setSlideDirection(direction);
        setIsTransitioning(true);
        setActiveTab(targetTab);
      }
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "ideas") {
      document.body.classList.add("admin-route");
    } else {
      document.body.classList.remove("admin-route");
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    if (tab === activeTab || isTransitioning) return;

    const tabIndices = { new: 0, ideas: 1, session: 2 };
    const currentIndex = tabIndices[activeTab];
    const nextIndex = tabIndices[tab];
    const direction = nextIndex > currentIndex ? "forward" : "backward";

    setPrevTab(activeTab);
    setSlideDirection(direction);
    setIsTransitioning(true);
    setActiveTab(tab);

    setAdminSuccess(null);
    setAdminError(null);
    let path = "/";
    if (tab === "ideas") path = "/admin";
    else if (tab === "session") path = "/session";
    window.history.pushState({}, "", path);
  };

  // ── Firestore real-time sync ──
  useEffect(() => {
    if (!isConfigured || !sessionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDbError(null);
    const ref = collection(db, "sessions", sessionId, "tokens");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data = {};
        snapshot.forEach((d) => { data[d.id] = d.data(); });
        setTokensData(data);
      },
      (err) => {
        console.error("Firestore sync error:", err);
        setDbError(`Fout bij laden: ${err.message}`);
      }
    );
    return () => unsubscribe();
  }, [sessionId, isConfigured]);

  // ── Seed ID logic: always increment, never reuse ──
  const getNextSeedId = () => {
    const numbers = Object.keys(tokensData).map(seedNum);
    const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `seed-${String(highest + 1).padStart(3, "0")}`;
  };

  // ── Sorted list of existing seeds for admin ──
  const sortedSeeds = Object.entries(tokensData)
    .sort(([a], [b]) => seedNum(a) - seedNum(b));

  // ==========================================
  // USER FLOW (TAB A)
  // ==========================================
  const handleUserSubmit = async () => {
    if (!isConfigured) {
      setDbError("Firebase is niet geconfigureerd. Voeg je credentials toe.");
      return;
    }

    const newSeedId = getNextSeedId();

    let currentSketchDataUrl = sketchDataUrl;
    if (showSketch && hasSketch && canvasRef.current) {
      try {
        currentSketchDataUrl = canvasRef.current.toDataURL("image/png");
        setSketchDataUrl(currentSketchDataUrl);
      } catch (e) {
        console.error("Canvas export error:", e);
      }
    }

    setUserWizardStep("submitting");
    setDbError(null);

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", newSeedId);
      const num = seedNum(newSeedId);
      await setDoc(docRef, {
        tokenId: newSeedId,
        seedId: newSeedId,
        displayNumber: num,
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
      });
      setUserWizardStep("success");
    } catch (err) {
      console.error("Save failed:", err);
      setDbError(`Opslaan mislukt: ${err.message}`);
      setUserWizardStep("idea");
    }
  };

  const handleAddAnotherIdea = () => {
    setIdeaTitle("");
    setIdeaDescription("");
    setHasSketch(false);
    setSketchDataUrl(null);
    setShowSketch(false);
    setDbError(null);
    setFormResetKey((prev) => prev + 1);
    setUserWizardStep("idea");
  };

  const handleGoToManage = () => {
    handleAddAnotherIdea();
    handleTabChange("ideas");
  };

  // ==========================================
  // ADMIN FLOW (TAB B)
  // ==========================================
  const handleEditClick = (data) => {
    setIsEditing(true);
    setFormSeedId(data.tokenId || data.seedId);
    setFormTitle(data.title || "");
    setFormDescription(data.description || "");
    setFormSketch(data.sketch || null);
    setFormStatus(data.status || "active");
    setAdminError(null);
    setAdminSuccess(null);
  };

  const resetAdminForm = () => {
    setFormSeedId(getNextSeedId());
    setFormTitle("");
    setFormDescription("");
    setFormSketch(null);
    setFormStatus("active");
    setIsEditing(false);
  };

  // Keep formSeedId in sync with next ID when not editing
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEditing) setFormSeedId(getNextSeedId());
  }, [tokensData, isEditing]);


  const handleAdminSave = async (e) => {
    e.preventDefault();
    if (!isConfigured) { setAdminError("Firebase is niet geconfigureerd."); return; }
    if (!formTitle.trim()) { setAdminError("Voer een titel in."); return; }

    setAdminError(null);
    setAdminSuccess(null);

    const targetId = formSeedId || getNextSeedId();

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", targetId);
      const existing = tokensData[targetId];
      const num = seedNum(targetId);

      const payload = {
        tokenId: targetId,
        seedId: targetId,
        displayNumber: num,
        title: formTitle.trim(),
        description: formDescription.trim(),
        sketch: formSketch,
        status: formStatus,
        source: "admin",
        updatedAt: serverTimestamp()
      };

      if (!existing || !isEditing) {
        payload.createdAt = serverTimestamp();
        payload.cluster = null;
        payload.position = { x: null, y: null };
        payload.priority = null;
      }

      await setDoc(docRef, payload, { merge: true });
      setAdminSuccess(
        isEditing
          ? `Idee "${formTitle.trim()}" bijgewerkt.`
          : `Idee "${formTitle.trim()}" toegevoegd.`
      );
      resetAdminForm();
    } catch (err) {
      console.error("Admin save error:", err);
      setAdminError(`Opslaan mislukt: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (seedId, title) => {
    if (!isConfigured) return;
    const displayName = title ? `"${title}"` : "dit idee";
    if (!window.confirm(`Weet je zeker dat je ${displayName} permanent wilt verwijderen?`)) return;
    try {
      setAdminError(null);
      await deleteDoc(doc(db, "sessions", sessionId, "tokens", seedId));
      setAdminSuccess(`Idee ${displayName} verwijderd.`);
    } catch (err) {
      setAdminError(`Verwijderen mislukt: ${err.message}`);
    }
  };


  const handleGenerateSession = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newSession = `mobus-${randomNum}`;
    setSessionId(newSession);
    setScannerSuccess(`Nieuwe sessie gestart: ${newSession}`);
    // Clear banner after 3 seconds
    setTimeout(() => setScannerSuccess(null), 3000);
  };

  const handleStartSimulatedScanner = () => {
    setShowScanner(true);
    setScannerSuccess(null);
    setTimeout(() => {
      setSessionId("mobus-tafel-88");
      setScannerSuccess("Succesvol verbonden met mobus-tafel-88 via QR-code!");
      setShowScanner(false);
      // Clear banner after 3 seconds
      setTimeout(() => setScannerSuccess(null), 3000);
    }, 1800);
  };

  return (
    <div className="app-container">

      {/* Connection / Scan Success Banner */}
      {scannerSuccess && (
        <div className="scanner-success-banner success-pulse">
          <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
          <span style={{ color: "var(--text-primary)" }}>{scannerSuccess}</span>
        </div>
      )}

      <div className="tabs-viewport">
          {/* TAB A: NEW IDEA WIZARD */}
          <div className={getTabClassName("new")}>
            <main className="screen-container">
              {/* Step 1: Input form */}
              {userWizardStep === "idea" && (
                <div className="card">
                  <h2 className="card-title">Wat wil je inbrengen?</h2>
                  <p className="card-description">
                    Schrijf een gedachte, vraag of inzicht. Je input verschijnt als digitale seed op de interactieve tafel.
                  </p>

                  {!isConfigured && (
                    <div className="error-banner">
                      <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                      <div>
                        <div className="error-title">Firebase Config Alert</div>
                        Firebase is nog niet geconfigureerd. Je kan de UI testen, maar database opslag is inactief.
                      </div>
                    </div>
                  )}

                  <div className="input-group">
                    <label htmlFor="idea-title" className="input-label">Titel</label>
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
                    <label htmlFor="idea-desc" className="input-label">
                      Toelichting <span className="optional-tag">(optioneel)</span>
                    </label>
                    <textarea
                      id="idea-desc"
                      className="text-input textarea-input"
                      style={{ minHeight: "80px" }}
                      value={ideaDescription}
                      onChange={(e) => setIdeaDescription(e.target.value)}
                      placeholder="Voeg optioneel context of voorbeelden toe..."
                    />
                  </div>

                  {/* Optionele schets – inklapbaar */}
                  <div className="sketch-toggle-section">
                    <button
                      type="button"
                      className="sketch-toggle-btn"
                      onClick={() => setShowSketch(!showSketch)}
                    >
                      <Pencil size={14} />
                      Schets toevoegen <span className="optional-tag">(optioneel)</span>
                      {showSketch ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <div className={`sketch-pad-wrapper ${showSketch ? "expanded" : ""}`}>
                      <SketchPad
                        key={formResetKey}
                        canvasRef={canvasRef}
                        initialSketch={sketchDataUrl}
                        onDrawStart={() => setHasSketch(true)}
                        onClear={() => { setHasSketch(false); setSketchDataUrl(null); }}
                      />
                    </div>
                  </div>

                  <button
                    id="plant-on-table-btn"
                    className="btn btn-primary"
                    onClick={handleUserSubmit}
                    disabled={!ideaTitle.trim()}
                    style={{ marginTop: "0.5rem" }}
                  >
                    <Sparkles size={18} />
                    Plaats op tafel
                  </button>
                </div>
              )}

              {/* Step 2: Loading */}
              {userWizardStep === "submitting" && (
                <div className="card">
                  <div className="loading-container">
                    <div className="spinner" />
                    <span className="loading-text">Je idee wordt verzonden...</span>
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {userWizardStep === "success" && (
                <div className="card success-card">
                  <div className="success-icon-wrapper success-pulse">
                    <CheckCircle2 size={36} />
                  </div>

                  <h2 className="card-title success-headline">Je idee is geplaatst</h2>

                  <div className="success-instruction success-instruction-prominent">
                    <span className="success-instruction-icon">💡</span>
                    Je idee verschijnt nu direct op de interactieve tafel.
                  </div>

                  <div className="success-instruction-secondary">
                    Orden dit idee straks samen met andere ideeën op de tafel — verschuif, cluster en verbind.
                  </div>

                  <div className="success-idea-summary">
                    <div className="input-label" style={{ marginBottom: "0.4rem" }}>Jouw inbreng:</div>
                    <div className="success-idea-title">{ideaTitle}</div>
                    {ideaDescription && (
                      <p className="idea-preview" style={{ marginTop: "0.35rem", fontStyle: "normal" }}>
                        {ideaDescription}
                      </p>
                    )}
                    {sketchDataUrl && (
                      <div className="sketch-thumbnail-container" style={{ width: "100%", marginTop: "0.5rem" }}>
                        <img src={sketchDataUrl} className="sketch-thumbnail-img" alt="Gekoppelde schets" />
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
                    <button id="add-another-idea-btn" className="btn btn-primary" onClick={handleAddAnotherIdea}>
                      <RefreshCw size={18} />
                      Nog een idee toevoegen
                    </button>
                    <button className="btn btn-secondary" onClick={handleGoToManage}>
                      <Settings size={18} />
                      Ga naar ideeënbeheer
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>

          {/* TAB B: IDEAS OVERVIEW (ADMIN) */}
          <div className={getTabClassName("ideas")}>
            <main className="admin-layout">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Feedback banners */}
                {adminSuccess && (
                  <div className="error-banner" style={{ backgroundColor: "var(--success-glow)", borderColor: "var(--success)" }}>
                    <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
                    <span style={{ color: "var(--text-primary)" }}>{adminSuccess}</span>
                  </div>
                )}

                {/* Empty state */}
                {sortedSeeds.length === 0 ? (
                  <div className="admin-empty-state">
                    <div className="admin-empty-icon">💡</div>
                    <h3 className="admin-empty-title">Nog geen ideeën toegevoegd</h3>
                    <p className="admin-empty-desc">
                      Er zijn nog geen ideeën toegevoegd aan deze sessie. Zodra je een idee toevoegt, verschijnt het hier.
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => handleTabChange("new")}
                    >
                      <Plus size={16} />
                      Idee toevoegen
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Section header */}
                    <div className="admin-section-header">
                      <div>
                        <h2 className="admin-section-title">Toegevoegde ideeën</h2>
                        <p className="admin-section-sub">Hier zie je alle ideeën die in deze sessie zijn toegevoegd.</p>
                      </div>
                      <span className="admin-seed-count">{sortedSeeds.length}</span>
                    </div>

                    <div className="admin-card-list">
                      {sortedSeeds.map(([id, data]) => (
                        <AdminSeedCard
                          key={id}
                          seedId={id}
                          data={data}
                          isEditing={isEditing && formSeedId === id}
                          formTitle={formTitle}
                          formDescription={formDescription}
                          formSketch={formSketch}
                          setFormTitle={setFormTitle}
                          setFormDescription={setFormDescription}
                          setFormSketch={setFormSketch}
                          onSave={handleAdminSave}
                          onCancel={resetAdminForm}
                          onEdit={(d) => handleEditClick(d)}
                          onDelete={(id) => handlePermanentDelete(id, data.title)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </main>
          </div>

          {/* TAB C: SESSION MANAGEMENT */}
          <div className={getTabClassName("session")}>
            <main className="screen-container">
              <div className="card">
                <h2 className="card-title">Sessiebeheer</h2>
                <p className="card-description">
                  Beheer de actieve sessie om verbinding te maken met de interactieve tafel.
                </p>

                <div className="input-group">
                  <label htmlFor="session-id-input" className="input-label">Sessiecode handmatig invoeren</label>
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

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleStartSimulatedScanner}
                  >
                    <QrCode size={18} />
                    Scan QR-code
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleGenerateSession}
                  >
                    <Plus size={18} />
                    Start nieuwe sessie
                  </button>
                </div>
              </div>
            </main>
          </div>
      </div>

      {/* Technical Offline/Sync Errors Subtle Footer Status */}
      {(!isOnline || dbError || adminError) && (
        <div className={`subtle-status-bar ${isKeyboardVisible ? "hidden" : ""}`}>
          <AlertTriangle size={14} className="status-warning-icon" />
          <span>
            {!isOnline
              ? "Verbinding verbroken"
              : (
                  (dbError && (dbError.toLowerCase().includes("offline") || dbError.toLowerCase().includes("network"))) ||
                  (adminError && (adminError.toLowerCase().includes("offline") || adminError.toLowerCase().includes("network")))
                )
              ? "Opnieuw verbinden..."
              : "Niet opgeslagen"}
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════════
          BOTTOM NAVIGATION BAR
      ═══════════════════════════════════════ */}
      <nav className={`bottom-nav ${isKeyboardVisible ? "nav-hidden" : ""}`}>
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === "new" ? "active" : ""}`}
          onClick={() => handleTabChange("new")}
        >
          <Plus size={20} />
          <span>Nieuw</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === "ideas" ? "active" : ""}`}
          onClick={() => handleTabChange("ideas")}
        >
          <LayoutGrid size={20} />
          <span>Ideeën</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${activeTab === "session" ? "active" : ""}`}
          onClick={() => handleTabChange("session")}
        >
          <QrCode size={20} />
          <span>Sessie</span>
        </button>
      </nav>

      {/* ═══════════════════════════════════════
          QR SCANNER OVERLAY
      ═══════════════════════════════════════ */}
      {showScanner && (
        <div className="scanner-overlay">
          <div className="scanner-header">
            <h3>QR-code scannen</h3>
            <button type="button" className="scanner-close-btn" onClick={() => setShowScanner(false)}>Sluiten</button>
          </div>
          <div className="scanner-viewfinder">
            <div className="scanner-frame">
              <div className="scanner-laser"></div>
              <div className="corner top-left"></div>
              <div className="corner top-right"></div>
              <div className="corner bottom-left"></div>
              <div className="corner bottom-right"></div>
            </div>
          </div>
          <div className="scanner-footer">
            <p>Richt je camera op de QR-code van de tafel...</p>
            <div className="scanner-simulating-badge">Simulatie camera actief...</div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          DEBUG CONSOLE (?debug=true)
      ═══════════════════════════════════════ */}
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
            <div>Database pad: <strong className="debug-path">sessions/{sessionId}/tokens</strong></div>
            <div>Verbinding: <strong>{isConfigured ? "Actief" : "Niet geconfigureerd"}</strong></div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
              <strong>Digitale Seeds:</strong>
            </div>
            <div>Aangemaakt: <strong>{sortedSeeds.length}</strong></div>
            <div>Hoogste nummer: <strong>{sortedSeeds.length > 0 ? Math.max(...sortedSeeds.map(([id]) => seedNum(id))) : "–"}</strong></div>
            <div>Volgende seed ID: <strong style={{ color: "var(--accent)" }}>{getNextSeedId()}</strong></div>
            <div>
              <div>Bestaande seeds:</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", wordBreak: "break-all" }}>
                {sortedSeeds.map(([id, d]) => `${id} (${d.status})`).join(", ") || "Geen"}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
