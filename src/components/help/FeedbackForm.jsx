// In-app feedback — writes to the Feedback entity for the review dashboard.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Send, CheckCircle2 } from "lucide-react";
import ChipSelect from "@/components/ui/ChipSelect";

const CATEGORIES = ["bug", "idea", "confusing", "other"];

export default function FeedbackForm() {
  const [category, setCategory] = useState("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const m = message.trim();
    if (!m || sending) return;
    setSending(true); setError("");
    try {
      await base44.entities.Feedback.create({ category, message: m, page: "help", status: "new" });
      setSent(true);
    } catch {
      setError("Couldn't send that. Try again.");
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="card-base p-5 flex items-center gap-3">
        <CheckCircle2 size={20} style={{ color: "var(--positive)" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Got it — thank you.</p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>We read every single one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-base p-4 space-y-3">
      <p className="eyebrow">Send Feedback</p>
      <ChipSelect label="What kind?" options={CATEGORIES} value={category} onChange={setCategory} />
      <textarea
        className="w-full rounded px-4 py-3 text-sm outline-none resize-none h-24"
        style={{ background: "var(--surface-0)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}
        placeholder="What's broken, confusing, or missing?"
        value={message}
        maxLength={1000}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
      <button onClick={submit} disabled={!message.trim() || sending} className="btn-stamp w-full">
        <Send size={13} /> {sending ? "Sending…" : "Send Feedback"}
      </button>
    </div>
  );
}