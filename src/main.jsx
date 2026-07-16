import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from '@/App.jsx'
import '@/index.css'

// Sentry — initialized only when a DSN is provided (VITE_SENTRY_DSN).
// Without a DSN, init is skipped and the ErrorBoundary still catches crashes.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

const CrashFallback = () => (
  <div style={{
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0A0B0D', color: '#F5F5F0', padding: 24, textAlign: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
  }}>
    <div style={{ maxWidth: 360 }}>
      <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 22, marginBottom: 12 }}>
        SOMETHING BROKE.
      </h1>
      <p style={{ color: 'rgba(245,245,240,0.64)', fontSize: 14, marginBottom: 24 }}>
        The error was reported automatically. Reload to get back on the field.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          minHeight: 52, padding: '0 24px', background: '#FF5A1F', color: '#0A0B0D',
          fontWeight: 600, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
          borderRadius: 12, border: 'none', cursor: 'pointer',
        }}
      >
        Reload App
      </button>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <Sentry.ErrorBoundary fallback={<CrashFallback />}>
    <App />
  </Sentry.ErrorBoundary>
)