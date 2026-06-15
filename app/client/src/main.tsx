import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import SplashScreen from './components/SplashScreen.tsx';
import { initTheme } from './lib/theme.ts';

initTheme();

function Root() {
  // Demo-only splash, opt-in via ?splash=on (off by default).
  const [showSplash, setShowSplash] = useState(
    () => new URLSearchParams(window.location.search).get('splash') === 'on'
  );

  return (
    <>
      <App />
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
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
