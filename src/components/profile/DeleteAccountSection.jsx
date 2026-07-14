// Two-step account deletion — type DELETE to confirm. Deletion is always allowed.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const doDelete = async () => {
    setBusy(true); setError(null);
    try {
      await base44.functions.invoke("deleteMyAccount", { confirm: text });
      base44.auth.logout("/");
    } catch (e) {
      setError(e.response?.data?.message || e.response?.data?.error || "Couldn't delete your account. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded border overflow-hidden" style={{ background: "var(--theme-surface)", borderColor: "var(--negative)" }}>
      <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: "var(--negative)" }}>Danger Zone</p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--theme-border)" }}>
          <Trash2 size={15} style={{ color: "var(--negative)" }} />
          <span className="font-elite text-xs uppercase tracking-widest" style={{ color: "var(--negative)" }}>Delete my account</span>
        </button>
      ) : (
        <div className="px-4 py-3 border-t space-y-3" style={{ borderColor: "var(--theme-border)" }}>
          <p className="text-xs" style={{ color: "var(--theme-ink-soft)" }}>
            This permanently removes your profile, logs, posts, and points. It can't be undone.
            If you have an active subscription, cancel it first in Manage Subscription above.
          </p>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder='Type DELETE to confirm'
            className="w-full rounded px-4 py-3 text-sm font-work outline-none"
            style={{ background: "var(--theme-bg)", border: "1px solid var(--negative)", color: "var(--theme-ink)" }} />
          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setText(""); setError(null); }}
              className="flex-1 py-2.5 rounded font-elite text-xs uppercase"
              style={{ background: "var(--theme-bg)", border: "1px solid var(--theme-border)", color: "var(--theme-ink-soft)" }}>
              Keep my account
            </button>
            <button onClick={doDelete} disabled={text !== "DELETE" || busy}
              className="flex-1 py-2.5 rounded font-elite text-xs uppercase disabled:opacity-40"
              style={{ background: "var(--negative)", color: "#fff" }}>
              {busy ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}