import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { EventType } from '@azure/msal-browser';
import router from './router';
import { msalInstance } from './config/msalConfig';
import { initTheme } from './shared/store/themeStore';
import MuiThemeBridge from './shared/context/MuiThemeBridge';

initTheme();

// After a deploy, an already-open tab still references the previous build's
// hashed chunks, which no longer exist (the server falls back to index.html).
// Reload once to pick up the new index.html and its current chunk names; the
// sessionStorage guard prevents a reload loop if the asset is genuinely missing.
const CHUNK_RELOAD_KEY = 'chunk-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - lastReload < 10000) return;
  event.preventDefault();
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
});

msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});

async function bootstrap() {
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise().catch(() => {});

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <MsalProvider instance={msalInstance}>
      <MuiThemeBridge>
        <RouterProvider router={router} />
      </MuiThemeBridge>
    </MsalProvider>
  );
}

bootstrap();
