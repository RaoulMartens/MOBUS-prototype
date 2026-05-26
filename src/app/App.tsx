import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router';
import { TokenProvider, useTokens } from './contexts/TokenContext';
import { TokenClusteringCanvas } from './components/TokenClusteringCanvas';
import { SystemInsights } from './components/SystemInsights';
import { IdeaGarden } from './components/IdeaGarden';
import { Dashboard } from './components/Dashboard';
import { Landing } from './components/Landing';
import { PhoneApp } from './components/PhoneApp';

const createSessionId = () => `mobus-${Math.floor(1000 + Math.random() * 9000)}`;

function DashboardWrapper() {
  const navigate = useNavigate();
  const { updateSessionId } = useTokens();

  const handleSelectApp = (appId: string) => {
    if (appId === 'idea-ecosystem') {
      const sessionId = createSessionId();
      updateSessionId(sessionId);
      navigate(`/table?sessionId=${sessionId}`);
    } else if (appId === 'phone-input') {
      navigate('/phone');
    }
  };

  return <Dashboard onSelectApp={handleSelectApp} />;
}

function LandingWrapper() {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/dev/wall');
  };

  return <Landing onEnter={handleEnter} />;
}

function StartSessionRedirect() {
  const navigate = useNavigate();
  const { updateSessionId } = useTokens();

  useEffect(() => {
    const sessionId = createSessionId();
    updateSessionId(sessionId);
    navigate(`/table?sessionId=${sessionId}`, { replace: true });
  }, []);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenProvider>
        <div className="size-full bg-black">
          <Routes>
            <Route path="/" element={<DashboardWrapper />} />
            <Route path="/landing" element={<StartSessionRedirect />} />
            <Route path="/dev/setup" element={<LandingWrapper />} />
            <Route path="/dashboard" element={<DashboardWrapper />} />
            <Route path="/dev/wall" element={<SystemInsights />} />
            <Route path="/table" element={<TokenClusteringCanvas />} />
            <Route path="/input" element={<IdeaGarden />} />
            <Route path="/phone" element={<PhoneApp />} />
            <Route path="/phone/admin" element={<PhoneApp />} />
            <Route path="/phone/session" element={<PhoneApp />} />
          </Routes>
        </div>
      </TokenProvider>
    </BrowserRouter>
  );
}
