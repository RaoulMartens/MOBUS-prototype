import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router';
import { TokenProvider } from './contexts/TokenContext';
import { TokenClusteringCanvas } from './components/TokenClusteringCanvas';
import { SystemInsights } from './components/SystemInsights';
import { IdeaGarden } from './components/IdeaGarden';
import { Dashboard } from './components/Dashboard';
import { Landing } from './components/Landing';

function DashboardWrapper() {
  const navigate = useNavigate();

  const handleSelectApp = (appId: string) => {
    if (appId === 'idea-ecosystem') {
      navigate('/landing');
    }
  };

  return <Dashboard onSelectApp={handleSelectApp} />;
}

function LandingWrapper() {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/overview');
  };

  return <Landing onEnter={handleEnter} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenProvider>
        <div className="size-full bg-black">
          <Routes>
            <Route path="/" element={<DashboardWrapper />} />
            <Route path="/landing" element={<LandingWrapper />} />
            <Route path="/dashboard" element={<DashboardWrapper />} />
            <Route path="/overview" element={<SystemInsights />} />
            <Route path="/table" element={<TokenClusteringCanvas />} />
            <Route path="/input" element={<IdeaGarden />} />
          </Routes>
        </div>
      </TokenProvider>
    </BrowserRouter>
  );
}