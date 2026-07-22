// Guardian landing page — /guardian?code=XXX. The parent signs in with the
// invited email, taps verify, done. Server enforces: email match + adult DOB.
import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function GuardianVerify() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const [state, setState] = useState("idle"); // idle | busy | done | error
  const [errMsg, setErrMsg] = useState("");

  const verify = async () => {
    setState("busy");
    try {
      await base44.functions.invoke("guardianConsent", { action: "verify", code });
      setState("done");
    } catch (e) {
      setErrMsg(e?.response?.data?.message || "This link couldn't be verified. Ask your athlete to send a fresh one.");
      setState("error");
    }
  };

  return (
    <div className="px-5 pt-6 pb-10 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
        <h1 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>Guardian Verification</h1>
      </div>

      {!code ? (
        <p className="font-work text-sm" style={{ color: 'var(--text-secondary)' }}>
          This page needs an invite link. Ask your athlete to send you theirs from Player → Settings.
        </p>
      ) : state === "done" ? (
        <>
          <p className="font-work text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            You're verified. Your athlete's account is now linked to yours.
          </p>
          <div className="card-base p-4 mb-4">
            <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              What you control from Player → Settings → Guardian Center:
              whether your athlete appears on public leaderboards, plus read
              visibility into any coach messaging on their account. Coach
              features stay locked until you approve them.
            </p>
          </div>
          <Link to="/profile" className="btn-primary w-full">Open Guardian Center</Link>
        </>
      ) : (
        <>
          <p className="font-work text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
            An athlete listed you as their parent or guardian on OFFSZN.
          </p>
          <p className="font-work text-xs leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
            Verifying links your account to theirs: you control their public
            visibility and get read access to any coach messaging. You must be
            signed in with the email the invite was sent to, with your date of
            birth on your account.
          </p>
          {state === "error" && (
            <div className="rounded p-3 mb-4 text-sm" style={{ background: 'var(--surface-1)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
              {errMsg}
            </div>
          )}
          <button onClick={verify} disabled={state === "busy"} className="btn-primary w-full">
            {state === "busy" ? <><Loader2 size={14} className="animate-spin mr-2 inline" /> Verifying…</> : "Verify — I'm the Guardian"}
          </button>
        </>
      )}
    </div>
  );
}