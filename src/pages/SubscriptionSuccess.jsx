// All-SZN Pass checkout success — fires pass_subscribed exactly once
// (session flag guards against refresh double-firing), then routes home.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { track } from "@/lib/analytics";

export default function SubscriptionSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const sid = new URLSearchParams(window.location.search).get("sid") || "pass";
    const key = `offszn_pass_success_${sid}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      track.passSubscribed();
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--surface-0)' }}>
      <CheckCircle2 size={44} style={{ color: 'var(--positive)' }} className="mb-4" />
      <h1 className="font-anton text-2xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>You're All-SZN.</h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Your pass is active. Every advanced stat, benchmark, and tool is unlocked.
      </p>
      <button onClick={() => navigate("/")} className="btn-primary w-full" style={{ maxWidth: 320 }}>
        Back to the Field
      </button>
    </div>
  );
}