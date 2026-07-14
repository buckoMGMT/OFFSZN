// Coach subscription checkout success — fires coach_subscribed exactly once,
// then lands the athlete in the coach's library.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CheckCircle2 } from "lucide-react";
import { track } from "@/lib/analytics";

export default function CoachSubscribed() {
  const { id } = useParams();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [coachName, setCoachName] = useState(params.get("coach_name") || "");

  useEffect(() => {
    const sid = params.get("sid") || id;
    const key = `offszn_coach_success_${sid}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      track.coachSubscribed({ coach_id: id, price_usd: parseFloat(params.get("price")) || undefined });
    }
    if (!coachName) {
      base44.entities.Athlete.get(id).then(c => setCoachName(c?.display_name || "your coach")).catch(() => setCoachName("your coach"));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--surface-0)' }}>
      <CheckCircle2 size={44} style={{ color: 'var(--positive)' }} className="mb-4" />
      <h1 className="font-anton text-2xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>You're In.</h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Message {coachName || "your coach"} anytime — your 1-on-1 coaching service is live.
      </p>
      <button onClick={() => navigate("/drills")} className="btn-primary w-full" style={{ maxWidth: 320 }}>
        Open the Library
      </button>
    </div>
  );
}