// Coach Studio — professional home for coaches (§2). Coach role only.
// LAUNCH tabs: Overview · My Content · Subscribers. POST stubs: Analytics deep-dive · Payouts.
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CoachStudio from "@/components/profile/CoachStudio";
import StudioOverview from "@/components/studio/StudioOverview";
import StudioContent from "@/components/studio/StudioContent";
import StudioSubscribersTab from "@/components/studio/StudioSubscribersTab";
import StudioPayouts from "@/components/studio/StudioPayouts";

const TABS = [
  ["overview", "Overview"],
  ["content", "My Content"],
  ["subscribers", "Subscribers"],
  ["analytics", "Analytics"],
  ["payouts", "Payouts"],
];

export default function Studio() {
  const [athlete, setAthlete] = useState(null);
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  const reload = useCallback(async () => {
    const list = await base44.entities.Athlete.list("-created_date", 1);
    const a = list[0] || null;
    setAthlete(a);
    if (a?.role === "coach") {
      const d = await base44.entities.UserVideoSubmission.filter({ athlete_id: a.id }, "-created_date", 100);
      setDrills(d);
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return (
      <div className="px-5 pt-14 space-y-4" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="skeleton" style={{ width: "45%", height: 28 }} />
        <div className="skeleton" style={{ width: "100%", height: 120, borderRadius: "var(--r-lg)" }} />
        <div className="skeleton" style={{ width: "100%", height: 80, borderRadius: "var(--r-lg)" }} />
      </div>
    );
  }

  if (!athlete || athlete.role !== "coach") {
    return (
      <div className="px-5 pt-14 text-center" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 className="font-anton text-xl uppercase mb-2" style={{ color: "var(--text-primary)" }}>Coach Studio</h1>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          The Studio is for coach accounts. Athletes run their game from the Player tab.
        </p>
        <Link to="/profile" className="btn-secondary inline-flex">Go to Player</Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-32" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-anton text-2xl uppercase mb-4" style={{ color: "var(--text-primary)" }}>Coach Studio</h1>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 -mx-5 px-5">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className="flex-shrink-0 px-4 py-2 rounded-full font-elite text-[10px] uppercase tracking-widest"
            style={tab === v
              ? { background: "var(--accent)", color: "var(--on-accent)" }
              : { background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
            {l}
          </button>
        ))}
      </div>

      {tab === "overview" && <StudioOverview athlete={athlete} drills={drills} />}
      {tab === "content" && <StudioContent athlete={athlete} drills={drills} onChanged={reload} />}
      {tab === "subscribers" && <StudioSubscribersTab athlete={athlete} />}
      {tab === "analytics" && (
        <div className="space-y-3">
          <CoachStudio athlete={athlete} />
          <p className="text-xs text-center py-2" style={{ color: "var(--text-tertiary)" }}>
            Coming soon — deeper analytics: subscriber growth, churn, and revenue trends.
          </p>
        </div>
      )}
      {tab === "payouts" && <StudioPayouts athlete={athlete} />}
    </div>
  );
}