import React, { useState, useEffect, useRef } from "react";
import { db, firebaseConfig, isConfigured } from "../../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { saveTokenToLocalBridge } from "../utils/localBridge";
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
  ChevronDown,
  ChevronUp,
  Pencil,
  QrCode,
  LayoutGrid
} from "lucide-react";
import "./PhoneApp.css";

// ── Utility: parse the numeric part of a seed id ──
const seedNum = (id: string) => {
  const m = id.match(/^seed-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
};

const getDrawingDataUrl = (data: any): string | null => {
  return data?.drawingDataUrl || data?.sketch || null;
};

const isParkedIdea = (data: any): boolean => {
  return data?.archived === true || data?.parked === true || data?.status === "archived";
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const toFirestoreFields = (value: any): any => {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreFields) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, toFirestoreFields(item)])
      ),
    },
  };
};

const setDocViaRest = async (path: string, payload: Record<string, any>) => {
  const projectId = firebaseConfig.projectId;
  const apiKey = firebaseConfig.apiKey;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodedPath}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, toFirestoreFields(value)])
      ),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`REST write failed (${response.status}): ${message}`);
  }
};

const normalizeSessionId = (value: string): string => {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `mobus-${trimmed}` : trimmed;
};

// ==========================================
// SKETCHPAD SUB-COMPONENT (HTML5 CANVAS)
// ==========================================
interface SketchPadProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  initialSketch: string | null;
  onDrawStart?: () => void;
  onClear?: () => void;
}

function SketchPad({ canvasRef, initialSketch, onDrawStart, onClear }: SketchPadProps) {
  const isDrawingRef = useRef(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const brushSize = 4;
  const brushColor = "#000000";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;

        let tempImage: string | null = null;
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
        context.strokeStyle = brushColor;
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
  }, [initialSketch, canvasRef]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = brushColor;
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushColor]);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: any) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    if (contextRef.current) {
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
    }
    isDrawingRef.current = true;
    if (onDrawStart) onDrawStart();
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    if (contextRef.current) {
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
    }
  };

  const stopDrawing = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
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
    </div>
  );
}

// ==========================================
// ADMIN SEED CARD SUB-COMPONENT
// ==========================================
interface AdminSeedCardProps {
  seedId: string;
  data: any;
  isEditing: boolean;
  formTitle: string;
  formDescription: string;
  formSketch: string | null;
  setFormTitle: (val: string) => void;
  setFormDescription: (val: string) => void;
  setFormSketch: (val: string | null) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
  onEdit: (data: any) => void;
  onDelete: (seedId: string) => void;
  onRestore: (seedId: string) => void;
}

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
  onDelete,
  onRestore
}: AdminSeedCardProps) {
  const isParked = isParkedIdea(data);

  return (
    <div className={`admin-token-card ${isEditing ? "editing-mode" : ""} ${getDrawingDataUrl(data) ? "has-sketch" : ""}`}>
      {isEditing && !isParked ? (
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
            {getDrawingDataUrl(data) && (
              <div className="sketch-thumbnail-container" style={{ marginTop: "0.5rem" }}>
                <img src={getDrawingDataUrl(data)!} className="sketch-thumbnail-img" alt="Idea sketch" />
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="seed-card-actions">
            {isParked ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onRestore(seedId)}
                style={{ width: "100%" }}
              >
                <RefreshCw size={14} />
                Terug op tafel plaatsen
              </button>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN PHONE APP COMPONENT
// ==========================================
export function PhoneApp() {
  const urlParams = new URLSearchParams(window.location.search);
  const showDebug = urlParams.get("debug") === "true";
  const urlSessionId = urlParams.get("sessionId");
  const initialUrlSessionId = urlSessionId ? normalizeSessionId(urlSessionId) : "";

  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname;
    if (path.includes("/admin") || path.includes("/manage")) return "ideas";
    if (path.includes("/session")) return "session";
    return "new";
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevTab, setPrevTab] = useState<string | null>(null);
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

  useEffect(() => {
    document.title = "MOBUS - Mobiele App";
    document.body.classList.add("phone-body");
    return () => {
      document.body.classList.remove("phone-body");
    };
  }, []);

  const getTabClassName = (tabName: string) => {
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
  const [scannerSuccess, setScannerSuccess] = useState<string | null>(null);

  // Connection & Pairing states
  const [isPaired, setIsPaired] = useState(() => {
    return !!initialUrlSessionId || localStorage.getItem("isPaired") === "true";
  });
  const [tempSessionId, setTempSessionId] = useState(() => {
    const paired = localStorage.getItem("isPaired") === "true";
    if (initialUrlSessionId) return initialUrlSessionId;
    return paired ? (localStorage.getItem("pairedSessionId") || "") : "";
  });
  const [sessionId, setSessionId] = useState(() => {
    if (initialUrlSessionId) return initialUrlSessionId;
    return localStorage.getItem("pairedSessionId") || "mobus-tafel-88";
  });

  const [tokensData, setTokensData] = useState<Record<string, any>>({});
  const [dbError, setDbError] = useState<string | null>(null);

  const handleConnectSession = () => {
    if (tempSessionId.trim()) {
      const formattedId = normalizeSessionId(tempSessionId);
      setSessionId(formattedId);
      setIsPaired(true);
      localStorage.setItem("isPaired", "true");
      localStorage.setItem("pairedSessionId", formattedId);
      localStorage.setItem("sessionId", formattedId);
    }
  };

  useEffect(() => {
    if (!initialUrlSessionId) return;
    setSessionId(initialUrlSessionId);
    setTempSessionId(initialUrlSessionId);
    setIsPaired(true);
    localStorage.setItem("isPaired", "true");
    localStorage.setItem("pairedSessionId", initialUrlSessionId);
    localStorage.setItem("sessionId", initialUrlSessionId);
  }, []);

  // --- TAB A: NEW IDEA WIZARD ---
  const [userWizardStep, setUserWizardStep] = useState("idea");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSketch, setHasSketch] = useState(false);
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [showSketch, setShowSketch] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);

  // --- TAB B: ADMIN ---
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formSeedId, setFormSeedId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSketch, setFormSketch] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState("active");

  // Keyboard visibility detection (on focus of inputs/textareas)
  useEffect(() => {
    const handleFocus = (e: any) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setIsKeyboardVisible(true);
      }
    };
    const handleBlur = (e: any) => {
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
      if (path.includes("/admin") || path.includes("/manage")) {
        targetTab = "ideas";
      } else if (path.includes("/session")) {
        targetTab = "session";
      }

      if (targetTab !== activeTab) {
        const tabIndices: Record<string, number> = { new: 0, ideas: 1, session: 2 };
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
    return () => {
      document.body.classList.remove("admin-route");
    };
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    if (tab === activeTab || isTransitioning) return;

    const tabIndices: Record<string, number> = { new: 0, ideas: 1, session: 2 };
    const currentIndex = tabIndices[activeTab];
    const nextIndex = tabIndices[tab];
    const direction = nextIndex > currentIndex ? "forward" : "backward";

    setPrevTab(activeTab);
    setSlideDirection(direction);
    setIsTransitioning(true);
    setActiveTab(tab);

    setAdminSuccess(null);
    setAdminError(null);
    let path = "/phone";
    if (tab === "ideas") path = "/phone/admin";
    else if (tab === "session") path = "/phone/session";
    window.history.pushState({}, "", path);
  };

  // ── Firestore real-time sync ──
  useEffect(() => {
    if (!isConfigured || !sessionId) return;
    setDbError(null);
    const ref = collection(db, "sessions", sessionId, "tokens");
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const data: Record<string, any> = {};
        snapshot.forEach((d) => { data[d.id] = d.data(); });
        setTokensData(data);
      },
      (err) => {
        console.error("Firestore sync error:", err);
        setDbError(`Fout bij laden: ${err.message}`);
      }
    );
    return () => unsubscribe();
  }, [sessionId]);

  // ── Seed ID logic: always increment, never reuse ──
  const getNextSeedId = () => {
    const numbers = Object.keys(tokensData).map(seedNum);
    const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `seed-${String(highest + 1).padStart(3, "0")}`;
  };

  // ── Sorted list of existing seeds for admin ──
  const sortedSeeds = Object.entries(tokensData)
    .sort(([a], [b]) => seedNum(a) - seedNum(b));
  const activeSeeds = sortedSeeds.filter(([, data]) => !isParkedIdea(data));
  const parkedSeeds = sortedSeeds.filter(([, data]) => isParkedIdea(data));

  // ==========================================
  // USER FLOW (TAB A)
  // ==========================================
  const handleUserSubmit = async () => {
    if (!isConfigured) {
      setDbError("Opslaan is tijdelijk niet beschikbaar.");
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
      const now = new Date();
      const payload = {
        id: newSeedId,
        tokenId: newSeedId,
        seedId: newSeedId,
        displayNumber: num,
        title: ideaTitle.trim(),
        description: ideaDescription.trim(),
        drawingDataUrl: currentSketchDataUrl || null,
        sketch: currentSketchDataUrl || null,
        status: "pending_classification",
        archived: false,
        source: "phone",
        cluster: null,
        clusterId: null,
        position: { x: null, y: null },
        rotation: 0,
        priority: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      try {
        // Concurrently write to local bridge
        try {
          await saveTokenToLocalBridge(sessionId, newSeedId, {
            ...payload,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          });
        } catch (bridgeErr) {
          console.warn("Failed to write to local bridge from PhoneApp:", bridgeErr);
        }
        await withTimeout(setDoc(docRef, payload), 4000, "Firestore SDK timeout");
      } catch (sdkError) {
        console.warn("Firestore SDK write timed out; trying REST fallback:", sdkError);
        try {
          await withTimeout(
            setDocViaRest(`sessions/${sessionId}/tokens/${newSeedId}`, {
              ...payload,
              createdAt: now,
              updatedAt: now,
            }),
            8000,
            "REST write timeout"
          );
        } catch (restError) {
          console.warn("Firestore REST write failed; trying local bridge:", restError);
          await withTimeout(
            saveTokenToLocalBridge(sessionId, newSeedId, {
              ...payload,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            }),
            4000,
            "Opslaan duurt te lang. Controleer wifi/internet en probeer opnieuw."
          );
        }
      }

      // Trigger classification asynchronously
      const bridgeUrl = "http://localhost:8787";
      fetch(`${bridgeUrl}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(newSeedId)}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ideaTitle.trim(), description: ideaDescription.trim() }),
      }).catch(err => console.error("[Phone] Failed to start classification:", err));

      setUserWizardStep("success");
    } catch (err: any) {
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
  const handleEditClick = (data: any) => {
    setIsEditing(true);
    setFormSeedId(data.tokenId || data.seedId);
    setFormTitle(data.title || "");
    setFormDescription(data.description || "");
    setFormSketch(getDrawingDataUrl(data));
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
    if (!isEditing) setFormSeedId(getNextSeedId());
  }, [tokensData, isEditing]);


  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) { setAdminError("Opslaan is tijdelijk niet beschikbaar."); return; }
    if (!formTitle.trim()) { setAdminError("Voer een titel in."); return; }

    setAdminError(null);
    setAdminSuccess(null);

    const targetId = formSeedId || getNextSeedId();

    try {
      const docRef = doc(db, "sessions", sessionId, "tokens", targetId);
      const existing = tokensData[targetId];
      const num = seedNum(targetId);

      const payload: Record<string, any> = {
        id: targetId,
        tokenId: targetId,
        seedId: targetId,
        displayNumber: num,
        title: formTitle.trim(),
        description: formDescription.trim(),
        drawingDataUrl: formSketch,
        sketch: formSketch,
        status: formStatus === "archived" ? "archived" : "pending_classification",
        archived: formStatus === "archived",
        source: "admin",
        updatedAt: serverTimestamp()
      };

      if (!existing || !isEditing) {
        payload.createdAt = serverTimestamp();
        payload.cluster = null;
        payload.position = { x: null, y: null };
        payload.rotation = 0;
        payload.priority = null;
      }

      // Concurrently write to local bridge
      try {
        await saveTokenToLocalBridge(sessionId, targetId, {
          ...existing,
          ...payload,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (bridgeErr) {
        console.warn("Failed to write to local bridge in admin PhoneApp:", bridgeErr);
      }

      await setDoc(docRef, payload, { merge: true });

      if (formStatus !== "archived") {
        const bridgeUrl = "http://localhost:8787";
        fetch(`${bridgeUrl}/api/sessions/${encodeURIComponent(sessionId)}/tokens/${encodeURIComponent(targetId)}/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formTitle.trim(), description: formDescription.trim() }),
        }).catch(err => console.error("[Phone Admin] Failed to start classification:", err));
      }

      setAdminSuccess(
        isEditing
          ? `Idee "${formTitle.trim()}" bijgewerkt.`
          : `Idee "${formTitle.trim()}" toegevoegd.`
      );
      resetAdminForm();
    } catch (err: any) {
      console.error("Admin save error:", err);
      setAdminError(`Opslaan mislukt: ${err.message}`);
    }
  };

  const handlePermanentDelete = async (seedId: string, title?: string) => {
    if (!isConfigured) return;
    const displayName = title ? `"${title}"` : "dit idee";
    if (!window.confirm(`Weet je zeker dat je ${displayName} permanent wilt verwijderen?`)) return;
    try {
      setAdminError(null);
      await deleteDoc(doc(db, "sessions", sessionId, "tokens", seedId));
      setAdminSuccess(`Idee ${displayName} verwijderd.`);
    } catch (err: any) {
      setAdminError(`Verwijderen mislukt: ${err.message}`);
    }
  };

  const handleRestoreToTable = async (seedId: string) => {
    if (!isConfigured) return;

    try {
      setAdminError(null);
      const index = sortedSeeds.findIndex(([id]) => id === seedId);
      const position = {
        x: 320 + Math.max(index, 0) * 36,
        y: 220 + Math.max(index, 0) * 24,
      };

      await setDoc(doc(db, "sessions", sessionId, "tokens", seedId), {
        archived: false,
        parked: false,
        status: "active",
        cluster: null,
        clusterId: null,
        position,
        rotation: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setAdminSuccess("Idee terug op tafel geplaatst.");
    } catch (err: any) {
      setAdminError(`Terugplaatsen mislukt: ${err.message}`);
    }
  };



  const renderTabNav = (className = "") => (
    <nav className={className}>
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
  );

  return (
    <div className="phone-app-root">
      {!isPaired ? (
        <div className="pairing-container min-h-screen flex items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
          <div className="card max-w-sm w-full border border-zinc-950 dark:border-zinc-50 rounded shadow-none">
            <h2 className="card-title text-zinc-950 dark:text-zinc-50 font-bold mb-3 text-2xl text-center">MOBUS Ideeën Invoer</h2>
            <p className="card-description text-zinc-500 text-sm mb-6 text-center leading-relaxed">
              Voeg ideeën toe aan de digitale tafel. Elke bijdrage verschijnt direct als een interactief element op de tafel.
            </p>

            <div className="input-group mb-6">
              <label htmlFor="pairing-session-id" className="input-label text-zinc-400 font-bold mb-2 block uppercase tracking-wider text-xs">
                Sessiecode
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <KeyRound size={18} color="#71717a" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  id="pairing-session-id"
                  type="text"
                  className="text-input"
                  style={{ width: "100%", paddingLeft: "2.5rem" }}
                  value={tempSessionId}
                  onChange={(e) => setTempSessionId(e.target.value)}
                  placeholder="Bijv. mobus-tafel-88"
                  required
                />
              </div>
            </div>

            <button
              onClick={handleConnectSession}
              disabled={!tempSessionId.trim()}
              className="btn btn-primary w-full py-3.5 bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-zinc-800 border border-zinc-950 dark:border-zinc-50 font-bold rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Start sessie
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
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
                        <div className="error-title">Opslaan niet beschikbaar</div>
                        Je kan de interface bekijken, maar ideeën worden nu niet opgeslagen.
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
                  <h2 className="card-title success-headline">Idee geplaatst</h2>
                  <p className="success-copy">Je idee staat nu op de tafel.</p>

                  <div className="success-idea-summary">
                    <div className="success-idea-title">{ideaTitle}</div>
                    {sketchDataUrl && (
                      <div className="success-sketch-thumb">
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
                      <LayoutGrid size={18} />
                      Bekijk ideeën
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
                  <div className="card ideas-empty-card">
                    <h2 className="card-title">Ideeën</h2>
                    <p className="card-description">Hier zie je de ideeën die op tafel staan.</p>

                    <div className="admin-empty-state">
                      <h3 className="admin-empty-title">Nog geen ideeën</h3>
                      <p className="admin-empty-desc">Voeg je eerste idee toe om te starten.</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleTabChange("new")}
                      >
                        <Plus size={16} />
                        Idee toevoegen
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="card ideas-list-card">
                    {/* Section header */}
                    <div className="admin-section-header">
                      <div>
                        <h2 className="card-title">Ideeën</h2>
                        <p className="card-description">Hier zie je de ideeën die op tafel staan.</p>
                      </div>
                      <span className="admin-seed-count">{sortedSeeds.length}</span>
                    </div>

                    <div className="admin-subsection-header">
                      <h3>Actieve ideeën</h3>
                    </div>

                    {activeSeeds.length === 0 ? (
                      <p className="admin-section-empty">Geen actieve ideeën op tafel.</p>
                    ) : (
                      <div className="admin-card-list">
                        {activeSeeds.map(([id, data]) => (
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
                            onRestore={handleRestoreToTable}
                          />
                        ))}
                      </div>
                    )}

                    <div className="admin-subsection-header">
                      <div>
                        <h3>Geparkeerde ideeën</h3>
                        <p>Parkeren is tijdelijk. Verwijderen is definitief.</p>
                      </div>
                    </div>

                    {parkedSeeds.length === 0 ? (
                      <p className="admin-section-empty">Geen geparkeerde ideeën.</p>
                    ) : (
                      <div className="admin-card-list">
                        {parkedSeeds.map(([id, data]) => (
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
                            onRestore={handleRestoreToTable}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* TAB C: SESSION MANAGEMENT */}
          <div className={getTabClassName("session")}>
            <main className="screen-container">
              <div className="card">
                <h2 className="card-title">Sessie status</h2>
                <p className="card-description">
                  Je bent momenteel gekoppeld met de digitale tafel.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "center", marginBottom: "1.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Gekoppelde Sessiecode</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--mono, monospace)", color: "var(--text-primary)", border: "1px solid var(--border-color)", padding: "0.5rem 1rem", borderRadius: "var(--radius-md)", backgroundColor: "var(--bg-secondary)" }}>{sessionId}</span>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsPaired(false);
                    localStorage.removeItem("isPaired");
                  }}
                >
                  <RefreshCw size={16} />
                  Wissel van sessie
                </button>
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
      {renderTabNav(`bottom-nav ${isKeyboardVisible ? "nav-hidden" : ""}`)}



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
      )}
    </div>
  );
}
