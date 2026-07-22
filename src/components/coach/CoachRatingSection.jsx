// Coach ratings — summary ("4.8 ★ · 23"), approved text reviews, and the
// rate control for eligible subscribers (≥7 days subscribed, server-enforced).
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Star, Loader2 } from "lucide-react";

export function RatingSummary({ average, count }) {
  if (!count) return null;
  return (
    <span className="flex items-center gap-1 tabular-nums text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
      {average} <Star size={11} fill="var(--accent)" style={{ color: 'var(--accent)' }} /> · {count}
    </span>
  );
}

export default function CoachRatingSection({ coachId }) {
  const [data, setData] = useState(null);
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    base44.functions.invoke("rateCoach", { action: "get", coachAthleteId: coachId })
      .then(r => {
        setData(r.data);
        if (r.data?.my_rating) { setStars(r.data.my_rating.stars); setText(r.data.my_rating.review_text || ""); }
      })
      .catch(() => setData({ average: null, count: 0, eligible: false, reviews: [] }));
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    setMsg("");
    try {
      await base44.functions.invoke("rateCoach", { action: "rate", coachAthleteId: coachId, stars, reviewText: text });
      setMsg(text ? "Saved — your written review goes live after a quick check." : "Saved.");
      load();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Couldn't save your rating — try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="skeleton" style={{ height: 40, borderRadius: 'var(--r-md)' }} />;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="eyebrow">Ratings</p>
        {data.count > 0
          ? <RatingSummary average={data.average} count={data.count} />
          : <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>No ratings yet</span>}
      </div>

      {/* Approved written reviews */}
      {data.reviews?.length > 0 && (
        <div className="space-y-2 mb-3">
          {data.reviews.slice(0, 3).map((r, i) => (
            <div key={i} className="rounded border p-2.5" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{r.rater_name}</span>
                <span className="flex items-center gap-0.5 tabular-nums text-[10px]" style={{ color: 'var(--accent)' }}>
                  {r.stars} <Star size={9} fill="var(--accent)" style={{ color: 'var(--accent)' }} />
                </span>
              </div>
              <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.review_text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rate control — eligibility is enforced server-side; UI mirrors it */}
      {data.eligible ? (
        <div className="rounded border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
          <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
            {data.my_rating ? "Your rating — tap to change" : "Rate this coach"}
          </p>
          <div className="flex gap-1.5 mb-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`} className="p-1">
                <Star size={22} fill={n <= stars ? "var(--accent)" : "none"}
                  style={{ color: n <= stars ? 'var(--accent)' : 'var(--text-tertiary)' }} />
              </button>
            ))}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 300))}
            placeholder="Optional — what should other athletes know? (300 max)"
            rows={2} className="w-full rounded p-2 text-sm mb-2"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'none' }} />
          <button onClick={submit} disabled={saving || stars < 1} className="btn-secondary w-full" style={{ minHeight: 40 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : data.my_rating ? "Update Rating" : "Submit Rating"}
          </button>
          {msg && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{msg}</p>}
        </div>
      ) : (
        <p className="font-work text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Ratings open to subscribers after their first 7 days.
        </p>
      )}
    </div>
  );
}