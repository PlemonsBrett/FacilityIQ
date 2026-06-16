import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import { initTheme } from './lib/theme.ts';

initTheme();

function Root() {
  const splashEnabled = new URLSearchParams(window.location.search).get('splash') === 'on';
  const [showSplash, setShowSplash] = useState(() => splashEnabled);
  const [splashDone, setSplashDone] = useState(() => !splashEnabled);

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
