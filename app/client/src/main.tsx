import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import { initTheme } from './lib/theme.ts';

initTheme();

function Root() {
  // Show splash whenever fiq_tour_seen is absent — no URL param needed.
  // Hidden reset button clears localStorage so next load replays the full experience.
  const [showSplash, setShowSplash] = useState(() => !localStorage.getItem("fiq_tour_seen"));
  const [splashDone, setSplashDone] = useState(() => !!localStorage.getItem("fiq_tour_seen"));

  function handleSplashComplete() {
    setShowSplash(false);
    setSplashDone(true);
  }

  return (
    <>
      <App splashDone={splashDone} />
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>
);
