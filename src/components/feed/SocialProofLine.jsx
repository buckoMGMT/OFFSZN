// Real social-proof line for the Field header.
// Shows "[N] athletes trained this week" from a real count (growthStats).
// Hidden below a trust threshold — we never show a tiny/fake number on a
// youth platform. Nothing here is fabricated.
import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MIN_TO_SHOW = 10; // below this, stay silent rather than show a weak number

export default function SocialProofLine() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    base44.functions.invoke("growthStats", {})
      .then((res) => setCount(res.data?.weeklyActive ?? 0))
      .catch(() => setCount(0));
  }, []);

  if (count === null || count < MIN_TO_SHOW) return null;

  return (
    <div className="flex items-center gap-1.5 mb-3">
      <Users size={11} style={{ color: "var(--text-secondary)" }} />
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>{count.toLocaleString()}</span> athletes trained this week
      </span>
    </div>
  );
}