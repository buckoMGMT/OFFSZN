import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";

function AppleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

const inputStyle = {
  width: '100%',
  minHeight: 52,
  padding: '0 1rem 0 2.75rem',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-sm)',
  fontFamily: 'Inter, sans-serif',
  fontSize: 16, /* §3 — inputs < 16px trigger iOS focus zoom */
  outline: 'none',
};

const errorBoxStyle = {
  background: 'var(--surface-2)',
  color: 'var(--negative)',
  border: '1px solid var(--negative)',
};

function Checkbox({ checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border"
      style={{ background: checked ? 'var(--accent)' : 'transparent', borderColor: checked ? 'var(--accent)' : 'var(--border-strong)' }}
    >
      {checked && <span style={{ color: 'var(--on-accent)', fontSize: 10, fontWeight: 700 }}>✓</span>}
    </div>
  );
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [usResident, setUsResident] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!usResident) { setError("You must confirm you are a US resident to continue"); return; }
    if (!agreed) { setError("You must agree to the Terms of Service to continue"); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setShowOtp(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) base44.auth.setToken(result.access_token);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({ title: "Code sent", description: "Check your email for the new code." });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  // Absolute fromUrl — the OAuth callback must land back inside OFFSZN, never a default page.
  const dest = `${window.location.origin}/`;
  const handleGoogle = () => base44.auth.loginWithProvider("google", dest);
  const handleApple = () => base44.auth.loginWithProvider("apple", dest);

  if (showOtp) {
    return (
      <AuthLayout title="Verify Email" subtitle={`Code sent to ${email}`}>
        {error && (
          <div className="mb-4 p-3 rounded text-sm" style={errorBoxStyle}>
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus autoComplete="one-time-code">
            <InputOTPGroup>
              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <button onClick={handleVerify} disabled={loading || otpCode.length < 6} className="btn-primary w-full">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Verifying…</> : "Verify Code"}
        </button>
        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
          Didn't get it?{" "}
          <button onClick={handleResend} style={{ color: 'var(--accent)', fontWeight: 600 }}>Resend</button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join Up."
      subtitle="Create your account. Put in the work."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in</Link>
        </>
      }
    >
      {/* Social logins */}
      <button className="btn-secondary w-full mb-3" style={{ minHeight: 52 }} onClick={handleApple}>
        <AppleIcon /> Continue with Apple
      </button>
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
        <div className="mb-4 p-3 rounded text-sm" style={errorBoxStyle}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input type="email" autoComplete="email" placeholder="you@example.com" autoFocus
            value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input type="password" autoComplete="new-password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input type="password" autoComplete="new-password" placeholder="Confirm Password"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
        </div>

        {/* US Residency */}
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={usResident} onToggle={() => setUsResident(u => !u)} />
          <span className="text-xs leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            I confirm I am a <span style={{ color: 'var(--text-secondary)' }}>resident of the United States</span>. This service is not available outside the US.
          </span>
        </label>

        {/* Age + Terms agreement */}
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={agreed} onToggle={() => setAgreed(a => !a)} />
          <span className="text-xs leading-snug" style={{ color: 'var(--text-tertiary)' }}>
            I am at least <span style={{ color: 'var(--text-secondary)' }}>18 years old</span> and agree to the{" "}
            <span style={{ color: 'var(--text-secondary)' }}>Terms of Service</span> and{" "}
            <span style={{ color: 'var(--text-secondary)' }}>Privacy Policy</span>.
            This app is for athletic performance tracking only — not medical advice.
          </span>
        </label>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> Creating…</> : "Create Account"}
        </button>
      </form>
    </AuthLayout>
  );
}