/// bridge between the webpage and React. 
///It tells React where to place CreativeHUB and wraps the app with shared features.
/// It starts React, provides shared app features, and hands control to App. 
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'leaflet/dist/leaflet.css';
import './styles/index.css'; 
///These imports load styles used across the app, including map styles and the project’s own global styles.

// Every lazy-loaded page (see App.tsx's React.lazy() routes) is its own
// content-hashed JS file - the moment a new build deploys, the OLD hashed
// filenames stop existing on the server. A tab that's been open since
// before that happens (or one with a stale cached index.html) still tries
// to fetch the old filename, gets the server's catch-all text/html
// response back instead of a 404, and the browser refuses to run that as a
// module script - this is exactly what showed up as a white screen with
// "Failed to load module script... MIME type of text/html" in the console.
// Vite fires this exact event for this exact failure
// (https://vitejs.dev/guide/build.html#load-error-handling) - the fix is
// what Vite's own docs recommend: reload once to pick up the current
// index.html and its real chunk manifest. Guarded to at most once per 10s
// so a genuinely broken deploy (not just a stale chunk from before the
// latest one) shows an error instead of reloading forever.
window.addEventListener('vite:preloadError', () => {
  const key = 'creativehub:chunk-reload-at';
  const last = Number(sessionStorage.getItem(key) || 0);
  const now = Date.now();
  if (now - last > 10000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
});

const root = document.getElementById('root');

///It tells React to render the app inside the webpage’s root element, and wraps the app with shared features:

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <App />
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
///App decides whether the URL should show Explore or a profile. 