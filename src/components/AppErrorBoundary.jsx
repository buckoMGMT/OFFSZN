// Global error boundary — no raw developer error ever reaches the user.
// Crashes are reported to Sentry and the user gets a friendly recovery screen.
import React from "react";
import * as Sentry from "@sentry/react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try { Sentry.captureException(error, { extra: { componentStack: info?.componentStack } }); } catch { /* never block the fallback */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "var(--surface-0, #0A0B0D)" }}>
        <h1 className="font-anton text-2xl uppercase mb-2" style={{ color: "var(--text-primary, #F5F5F0)" }}>
          OFFSZN is catching its breath
        </h1>
        <p className="font-work text-sm max-w-xs mb-8" style={{ color: "var(--text-secondary, rgba(245,245,240,0.64))" }}>
          Something went sideways on our end — not yours. Give it another rep.
        </p>
        <button
          onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          className="btn-primary px-8"
        >
          Try again
        </button>
      </div>
    );
  }
}