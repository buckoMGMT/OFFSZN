// Studio Overview — identity state, real stat cards, get-discoverable checklist,
// and coach preview mode (§5: see your storefront exactly as an athlete does).
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BadgeCheck, ShieldAlert, Eye as EyeIcon, Check, Circle } from "lucide-react";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";

function StatCard({ label, value }) {
  return (
    <div className="card-base p-3 text-center">
      <p className="stat-number text-lg tabular-nums">{value}</p>
      <p className="eyebrow mt-1" style={{ fontSize: 9 }}>{label}</p>
    </div>
  );
}

export default function StudioOverview({ athlete, drills }) {
  const [subCount, setSubCount] = useState(null);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    base44.functions.invoke("studioSubscribers", {})
      .then(r => setSubCount((r.data?.subscribers || []).length))
      .catch(() => setSubCount(0));
  }, []);

  const approved = drills.filter(d => d.status === "approved");
  const totalViews = drills.reduce((s, d) => s + (d.view_count || d.views || 0), 0);
  const price = athlete.coach_sub_price_usd;
  const mrr = subCount !== null && price ? subCount * price : null;
  const verified = athlete.identity_status === "verified";

  const checklist = [
    { label: "Verify your identity", done: verified },
    { label: "Publish 3 drills", done: approved.length >= 3 },
    { label: "Write your coach bio", done: !!athlete.coach_bio },
    { label: "Add a profile photo", done: !!athlete.avatar_url },
    { label: "Set your monthly price", done: !!price },
    { label: "Agree to the minor-conduct standard", done: !!athlete.minor_conduct_agreed_at },
  ];

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="card-base p-4">
        <div className="flex items-center gap-3">
          {athlete.avatar_url && <img src={athlete.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" style={{ border: "2px solid var(--accent)" }} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-work text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{athlete.display_name}</p>
              {verified && <BadgeCheck size={14} className="flex-shrink-0" style={{ color: "var(--accent)" }} />}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {verified
                ? <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: "var(--positive)" }}>Identity verified</span>
                : <span className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-widest" style={{ color: "var(--warning)" }}>
                    <ShieldAlert size={10} /> Identity {athlete.identity_status || "unverified"}
                  </span>}
              {price ? <span className="tabular-nums text-[10px]" style={{ color: "var(--text-secondary)" }}>· ${Number(price).toFixed(2)}/mo</span> : null}
            </div>
          </div>
        </div>
        <button onClick={() => setPreview(true)}
          className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }}>
          <EyeIcon size={12} /> Preview my storefront
        </button>
      </div>

      {/* Stat cards — real data, zeros show as "—" */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Active Subscribers" value={subCount === null ? "…" : subCount || "—"} />
        <StatCard label="Monthly Revenue" value={mrr ? `$${mrr.toFixed(0)}` : "—"} />
        <StatCard label="Total Drill Views" value={totalViews || "—"} />
        <StatCard label="Avg Rating" value="—" />
      </div>

      {/* Get discoverable checklist */}
      {!athlete.coach_profile_complete && (
        <div className="card-base p-4">
          <p className="eyebrow mb-3">Get Discoverable</p>
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item.label} className="flex items-center gap-2">
                {item.done
                  ? <Check size={13} className="flex-shrink-0" style={{ color: "var(--positive)" }} />
                  : <Circle size={13} className="flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />}
                <span className="font-work text-xs" style={{ color: item.done ? "var(--text-tertiary)" : "var(--text-primary)" }}>{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-3" style={{ color: "var(--text-secondary)" }}>
            Finish these in Player → Coach Tools to appear in Drills and accept subscribers.
          </p>
        </div>
      )}

      <CoachProfileSheet open={preview} onClose={() => setPreview(false)} coach={athlete} videos={approved} />
    </div>
  );
}