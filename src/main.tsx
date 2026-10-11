/// bridge between the webpage and React. 
///It tells React where to place CreativeHUB and wraps the app with shared features.
/// It starts React, provides shared app features, and hands control to App. 
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './app/App';
import { AuthProvider } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import 'leaflet/dist/leaflet.css';
import './styles/index.css'; 
///These imports load styles used across the app, including map styles and the project’s own global styles.

const root = document.getElementById('root');

///It tells React to render the app inside the webpage’s root element, and wraps the app with shared features:

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
///App decides whether the URL should show Explore or a profile. 