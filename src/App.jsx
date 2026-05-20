import { useState } from "react";
import { db, isConfigured } from "./firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { 
  Database, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  AlertTriangle,
  RefreshCw,
  KeyRound
} from "lucide-react";
import "./App.css";

// The 6 seed tokens with corresponding design/color properties
const SEED_TOKENS = [
  { id: "seed-01", name: "Seed 01", class: "token-seed-01" },
  { id: "seed-02", name: "Seed 02", class: "token-seed-02" },
  { id: "seed-03", name: "Seed 03", class: "token-seed-03" },
  { id: "seed-04", name: "Seed 04", class: "token-seed-04" },
  { id: "seed-05", name: "Seed 05", class: "token-seed-05" },
  { id: "seed-06", name: "Seed 06", class: "token-seed-06" },
];

function App() {
  // Wizard steps: 'session' | 'idea' | 'token' | 'submitting' | 'success'
  const [step, setStep] = useState("session");
  const [sessionId, setSessionId] = useState("mobus-001");
  const [idea, setIdea] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [error, setError] = useState(null);

  // Reset to initial state but keep the active session code
  const resetForm = () => {
    setIdea("");
    setSelectedToken("");
    setError(null);
    setStep("idea");
  };

  // Completely reset session and form to go back to screen 1
  const resetSession = () => {
    setSessionId("mobus-001");
    setIdea("");
    setSelectedToken("");
    setError(null);
    setStep("session");
  };

  // Save the combination to Firestore
  const handleSaveToFirebase = async () => {
    if (!isConfigured) {
      setError(
        "Firebase is niet geconfigureerd. Vul je credentials in het '.env' bestand of direct in 'src/firebase.js'."
      );
      return;
    }

    setStep("submitting");
    setError(null);

    try {
      // Structure: sessions/{sessionId}/tokens/{tokenId}
      const tokenDocRef = doc(db, "sessions", sessionId, "tokens", selectedToken);
      
      const payload = {
        tokenId: selectedToken,
        idea: idea.trim(),
        status: "active",
        cluster: null,
        source: "phone",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Use setDoc with merge: true so existing fields can be preserved/merged
      await setDoc(tokenDocRef, payload, { merge: true });
      
      // Advance to confirmation screen
      setStep("success");
    } catch (err) {
      console.error("Firestore Save Error:", err);
      setError(
        `Het opslaan is mislukt: ${err.message || "Onbekende fout. Controleer de Firestore security rules."}`
      );
      setStep("token"); // return to selection to allow retry
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <h1 className="app-title">
            <Sparkles size={20} color="#6366f1" />
            MOBUS
          </h1>
          <span className="app-subtitle">Seed Input Screen</span>
        </div>
        {step !== "session" && (
          <div className="session-badge">
            {sessionId}
          </div>
        )}
      </header>

      {/* Main Form Screens */}
      <main className="screen-container">
        {/* Step 1: Session Start Screen */}
        {step === "session" && (
          <div className="card">
            <h2 className="card-title">MOBUS Seed Input</h2>
            <p className="card-description">
              Welkom bij de MOBUS inputlaag. Voer de sessiecode in die op het hoofdscherm wordt getoond om te beginnen.
            </p>

            {!isConfigured && (
              <div className="error-banner">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <div className="error-title">Firebase Config Alert</div>
                  Firebase is nog niet geconfigureerd. Je kan de UI testen, maar opslaan zal mislukken. Configureer `.env` of `src/firebase.js`.
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
                  placeholder="Bijv. mobus-001"
                />
              </div>
            </div>

            <button
              id="start-session-btn"
              className="btn btn-primary"
              onClick={() => setStep("idea")}
              disabled={!sessionId.trim()}
            >
              Start sessie
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 2: Idea Input Screen */}
        {step === "idea" && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: "auto", padding: "0.5rem" }}
                onClick={() => setStep("session")}
                title="Terug naar sessiecode"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="card-title">Nieuw idee</h2>
            </div>
            
            <p className="card-description">
              Vul hier je inzicht, idee of vraag in. Dit idee wordt gekoppeld aan de fysieke token die je kiest in de volgende stap.
            </p>

            <div className="input-group">
              <label htmlFor="idea-textarea" className="input-label">Wat wil je inbrengen?</label>
              <textarea
                id="idea-textarea"
                className="text-input textarea-input"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Typ hier je idee..."
              />
            </div>

            <button
              id="link-to-token-btn"
              className="btn btn-primary"
              onClick={() => setStep("token")}
              disabled={!idea.trim()}
            >
              Koppel aan token
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Step 3: Token Selection Screen */}
        {step === "token" && (
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: "auto", padding: "0.5rem" }}
                onClick={() => setStep("idea")}
                title="Terug naar idee"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="card-title">Kies token</h2>
            </div>

            <p className="card-description">
              Kies een van de onderstaande seed tokens om je idee aan te koppelen.
            </p>

            {error && (
              <div className="error-banner">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <div className="error-title">Fout bij opslaan</div>
                  {error}
                </div>
              </div>
            )}

            <div className="token-grid">
              {SEED_TOKENS.map((token) => (
                <button
                  key={token.id}
                  id={`token-btn-${token.id}`}
                  className={`token-button ${selectedToken === token.id ? "selected" : ""}`}
                  onClick={() => setSelectedToken(token.id)}
                  type="button"
                >
                  <div className={`token-indicator ${token.class}`} />
                  <span className="token-name">{token.name}</span>
                </button>
              ))}
            </div>

            <button
              id="send-to-table-btn"
              className="btn btn-primary"
              onClick={handleSaveToFirebase}
              disabled={!selectedToken}
            >
              <Database size={18} />
              Verstuur naar tafel
            </button>
          </div>
        )}

        {/* Step 4: Loading / Submitting State */}
        {step === "submitting" && (
          <div className="card">
            <div className="loading-container">
              <div className="spinner" />
              <span className="loading-text">Idee wordt gekoppeld aan {selectedToken}...</span>
              <p className="card-description" style={{ textAlign: "center" }}>
                We sturen de gegevens nu naar Firebase Firestore.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Success Confirmation Screen */}
        {step === "success" && (
          <div className="card success-card">
            <div className="success-icon-wrapper">
              <CheckCircle2 size={36} />
            </div>
            
            <h2 className="card-title">Idee Gekoppeld!</h2>
            
            <div className="success-badge">
              {selectedToken.toUpperCase()}
            </div>

            <div className="success-instruction">
              Leg de fysieke token nu op de interactieve tafel.
            </div>

            <div style={{ width: "100%", margin: "0.5rem 0 1rem 0", textAlign: "left" }}>
              <div className="input-label" style={{ marginBottom: "0.25rem" }}>Gekoppeld Idee:</div>
              <p className="idea-preview">"{idea}"</p>
            </div>

            <button
              id="add-another-idea-btn"
              className="btn btn-primary"
              onClick={resetForm}
            >
              <RefreshCw size={18} />
              Nog een idee toevoegen
            </button>
          </div>
        )}
      </main>

      {/* Footer / Step Indicators */}
      <footer className="app-footer">
        <div className="progress-dots">
          <div className={`dot ${step === "session" ? "active" : ""}`} />
          <div className={`dot ${step === "idea" ? "active" : ""}`} />
          <div className={`dot ${step === "token" || step === "submitting" ? "active" : ""}`} />
          <div className={`dot ${step === "success" ? "active" : ""}`} />
        </div>

        {step !== "session" && (
          <button 
            className="reset-session-btn" 
            onClick={resetSession}
            id="change-session-btn"
          >
            Wissel van sessie
          </button>
        )}
      </footer>
    </div>
  );
}

export default App;
