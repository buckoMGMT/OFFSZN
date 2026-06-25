import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";

function AppleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

const inputStyle = {
  background: '#272729',
  border: '1px solid #5E646B',
  color: '#EDEEF0',
  borderRadius: 4,
  padding: '0 1rem 0 2.75rem',
  height: 48,
  width: '100%',
  fontFamily: 'Work Sans, sans-serif',
  fontSize: 14,
  outline: 'none',
};

const socialBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: 48,
  borderRadius: 4,
  border: '1px solid #5E646B',
  background: '#272729',
  color: '#EDEEF0',
  fontFamily: 'Special Elite, cursive',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  cursor: 'pointer',
  marginBottom: 12,
  transition: 'border-color 0.15s',
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleGoogle = () => base44.auth.loginWithProvider("google", "/");
  const handleApple = () => base44.auth.loginWithProvider("apple", "/");

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: '#D7263D', fontWeight: 500 }}>
            Create one
          </Link>
        </>
      }
    >
      {/* Social logins */}
      <button style={socialBtnStyle} onClick={handleApple}>
        <AppleIcon /> Continue with Apple
      </button>
      <button style={socialBtnStyle} onClick={handleGoogle}>
        <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
      </button>

      {/* Divider */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid #272729' }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 font-elite text-xs uppercase" style={{ background: '#1B1B1D', color: '#5A5D63' }}>or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded font-work text-sm" style={{ background: '#D7263D22', color: '#D7263D', border: '1px solid #D7263D55' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5A5D63' }} />
          <input type="email" autoComplete="email" placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)}
            style={inputStyle} required autoFocus />
        </div>
        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#5A5D63' }} />
            <input type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle} required />
          </div>
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="font-elite text-xs uppercase" style={{ color: '#D7263D', letterSpacing: '0.06em' }}>
              Forgot password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="btn-stamp w-full mt-2"
          style={{ height: 48, fontSize: '0.85rem', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Logging in…</> : "Log In"}
        </button>
      </form>
    </AuthLayout>
  );
}