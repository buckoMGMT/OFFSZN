import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

const inputWrap = "relative";
const inputStyle = {
  width: '100%',
  minHeight: 52,
  padding: '0 1rem 0 2.75rem',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'Inter, sans-serif',
  fontSize: 16,
  outline: 'none',
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in (e.g. returning from an OAuth callback)? Go straight in —
  // never strand a live session on the login page.
  useEffect(() => {
    base44.auth.isAuthenticated().then((ok) => {
      if (ok) window.location.href = "/";
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  // Absolute fromUrl — the OAuth callback must land back inside OFFSZN, never a default page.
  const dest = `${window.location.origin}/`;
  const handleGoogle = () => base44.auth.loginWithProvider("google", dest);

  return (
    <AuthLayout
      title="Get In."
      subtitle="Log in and get back to work."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
            Create one
          </Link>
        </>
      }
    >
      {/* Social logins — Apple removed for web launch (provider not verified end-to-end).
          Native note: if any social login ships on iOS, Apple sign-in becomes mandatory. */}
      <button className="btn-secondary w-full" style={{ minHeight: 52 }} onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
      </button>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid var(--border-subtle)' }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 eyebrow" style={{ background: 'var(--surface-1)' }}>or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded text-sm" style={{ background: 'var(--surface-2)', color: 'var(--negative)', border: '1px solid var(--negative)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={inputWrap}>
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input type="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle} required autoFocus />
        </div>
        <div>
          <div className={inputWrap}>
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--text-tertiary)' }} />
            <input type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} required />
          </div>
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Logging in…</> : "Log In"}
        </button>
      </form>
    </AuthLayout>
  );
}