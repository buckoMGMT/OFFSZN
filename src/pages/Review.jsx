// /review — owner-only trust & safety queue. Access is enforced SERVER-SIDE
// in the reviewQueue function; this page just renders what it's allowed to see.
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import QueueHealth from "@/components/review/QueueHealth";
import MediaPendingTab from "@/components/review/MediaPendingTab";
import ReportsTab from "@/components/review/ReportsTab";
import FlaggedTab from "@/components/review/FlaggedTab";
import FeedbackTab from "@/components/review/FeedbackTab";

const TABS = [
  { id: "media", label: "Media" },
  { id: "reports", label: "Reports" },
  { id: "flagged", label: "Flagged" },
  { id: "feedback", label: "Feedback" },
];

export default function Review() {
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("media");

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("reviewQueue", { action: "load" });
      setData(res.data);
    } catch (e) {
      if (e.response?.status === 403 || e.response?.status === 401) setDenied(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Every mutation goes back through the server-gated function, then reloads.
  const act = async (payload) => {
    await base44.functions.invoke("reviewQueue", payload);
    load();
  };

  if (denied) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--surface-0)' }}>
      <ShieldAlert size={36} style={{ color: 'var(--negative)' }} className="mb-4" />
      <h1 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>This area is restricted to the app owner.</p>
      <Link to="/" className="btn-secondary">Back to the Field</Link>
    </div>
  );

  if (loading || !data) return (
    <div className="min-h-screen px-5 pt-14 space-y-4" style={{ background: 'var(--surface-0)', maxWidth: 560, margin: '0 auto' }}>
      <div className="skeleton" style={{ width: '45%', height: 28 }} />
      <div className="skeleton" style={{ width: '100%', height: 60, borderRadius: 'var(--r-lg)' }} />
      <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 'var(--r-lg)' }} />
    </div>
  );

  const counts = {
    media: data.media.length,
    reports: data.reports.length,
    flagged: data.flagged.length,
    feedback: data.feedback.filter(f => f.status === "new").length,
  };

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}>
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <div className="px-5 pt-12 pb-3">
          <Link to="/" className="inline-flex items-center gap-1.5 font-elite text-[9px] uppercase tracking-widest mb-3" style={{ color: 'var(--text-tertiary)' }}>
            <ArrowLeft size={11} /> Back
          </Link>
          <h1 className="font-anton text-2xl uppercase">Review Queue</h1>
          <QueueHealth media={data.media} reports={data.reports} />
        </div>

        <div className="flex border-b px-5" style={{ borderColor: 'var(--border-subtle)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-3 font-elite text-[9px] uppercase tracking-widest flex items-center justify-center gap-1.5"
              style={{
                color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
              {counts[t.id] > 0 && (
                <span className="tabular-nums px-1.5 rounded-full text-[9px]"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === "media" && <MediaPendingTab items={data.media} act={act} />}
          {tab === "reports" && <ReportsTab items={data.reports} act={act} />}
          {tab === "flagged" && <FlaggedTab items={data.flagged} act={act} />}
          {tab === "feedback" && <FeedbackTab items={data.feedback} act={act} />}
        </div>
      </div>
    </div>
  );
}