// Shareable recruiting card — the core viral loop.
// Renders REAL Athlete data only. Numbers are marked "verified" (from a logged
// DailyLog / tested strength max) vs "self-reported". Nothing is fabricated.
// Free users get the basic card; All-SZN Pass unlocks HD export + share.
import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { Share2, Download, Lock, ShieldCheck, Flame } from "lucide-react";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";

const IN = (n) => (n ? `${Math.floor(n / 12)}'${n % 12}"` : null);
const MILE = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : null);

function StatCell({ label, value, verified }) {
  if (!value) return null;
  return (
    <div className="flex flex-col items-center px-2 py-2">
      <div className="flex items-center gap-1">
        <span style={{ fontFamily: "'Archivo Black', sans-serif", fontVariantNumeric: "tabular-nums", fontSize: 20, color: "#fff", lineHeight: 1 }}>{value}</span>
        {verified && <ShieldCheck size={11} style={{ color: "#2FBF71" }} />}
      </div>
      <span style={{ fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{label}</span>
    </div>
  );
}

export default function RecruitingCard({ athlete, verifiedFlags = {} }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [note, setNote] = useState("");

  if (!athlete) return null;
  const isPremium = athlete.subscription_tier === "premium";
  const streak = athlete.current_streak_days || 0;

  const meta = [athlete.position, athlete.grade, athlete.school].filter(Boolean).join(" · ");

  const renderPng = async () => {
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: isPremium ? 3 : 1.5, // Pass = HD export
      useCORS: true,
    });
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const handleShare = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    setBusy(true); setNote("");
    try {
      const blob = await renderPng();
      const file = new File([blob], `${athlete.display_name || "athlete"}-offszn-card.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My OFFSZN card", text: "Built on OFFSZN — offsznapp.com" });
      } else {
        // Fallback: download the image
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        URL.revokeObjectURL(a.href);
        setNote("Saved to your device — post it anywhere.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") setNote("Couldn't share right now — try Save image.");
    } finally { setBusy(false); }
  };

  const handleSave = async () => {
    if (!isPremium) { setShowPaywall(true); return; }
    setBusy(true); setNote("");
    try {
      const blob = await renderPng();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${athlete.display_name || "athlete"}-offszn-card.png`; a.click();
      URL.revokeObjectURL(a.href);
      setNote("Saved to your device.");
    } catch {
      setNote("Couldn't save right now — try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {/* The card itself — captured to PNG */}
      <div
        ref={cardRef}
        className="relative overflow-hidden"
        style={{
          borderRadius: 16,
          background: "linear-gradient(150deg, #1A1D21 0%, #0A0B0D 60%)",
          border: "1px solid var(--border-strong)",
          filter: isPremium ? "none" : "none",
        }}
      >
        {/* Accent header band */}
        <div style={{ height: 6, background: "linear-gradient(90deg, var(--accent-hover), var(--accent-pressed))" }} />

        {/* Yard-line texture */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.06 }} preserveAspectRatio="none" viewBox="0 0 400 260">
          <g stroke="#fff" strokeWidth="1" fill="none">
            {[0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400].map(x => <line key={x} x1={x} y1="0" x2={x} y2="260" />)}
          </g>
        </svg>

        <div className="relative p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#23272C", border: "2px solid var(--accent)" }}>
              {athlete.avatar_url
                ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                : <span style={{ fontFamily: "'Archivo Black', sans-serif", color: "var(--accent)", fontSize: 22 }}>{(athlete.display_name || "A")[0].toUpperCase()}</span>}
            </div>
            <div className="min-w-0">
              <p style={{ fontFamily: "'Archivo Black', sans-serif", textTransform: "uppercase", color: "#fff", fontSize: 20, lineHeight: 1.05 }} className="truncate">{athlete.display_name}</p>
              <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: 2 }} className="truncate">
                {athlete.sport?.replace(/_/g, " ")}{meta ? ` — ${meta}` : ""}
              </p>
            </div>
            {streak > 0 && (
              <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(255,90,31,0.15)", border: "1px solid var(--accent)" }}>
                <Flame size={11} style={{ color: "var(--accent)" }} />
                <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>{streak}</span>
              </div>
            )}
          </div>

          {/* Stat grid — verified numbers marked with a green shield */}
          <div className="grid grid-cols-4 rounded-lg mb-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <StatCell label="Bench" value={athlete.bench_press_lbs} verified={verifiedFlags.bench_press_lbs} />
            <StatCell label="Squat" value={athlete.squat_lbs} verified={verifiedFlags.squat_lbs} />
            <StatCell label="Deadlift" value={athlete.deadlift_lbs} verified={verifiedFlags.deadlift_lbs} />
            <StatCell label="Mile" value={MILE(athlete.mile_time_seconds)} verified={verifiedFlags.mile_time_seconds} />
            <StatCell label="Height" value={IN(athlete.height_inches)} />
            <StatCell label="Weight" value={athlete.weight_lbs ? `${athlete.weight_lbs}` : null} verified={verifiedFlags.weight_lbs} />
          </div>

          {/* Verified legend — only when at least one verified number exists */}
          {Object.values(verifiedFlags).some(Boolean) && (
            <div className="flex items-center gap-1 mb-2">
              <ShieldCheck size={10} style={{ color: "#2FBF71" }} />
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Verified from logged / tested data</span>
            </div>
          )}

          {/* Branded footer — every share is a growth touch */}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 11, color: "var(--accent)", letterSpacing: "0.04em" }}>OFFSZN</span>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>Built on OFFSZN — offsznapp.com</span>
          </div>

          {!isPremium && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid var(--border-strong)" }}>
              <Lock size={9} style={{ color: "rgba(255,255,255,0.7)" }} />
              <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)" }}>Basic</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleShare} disabled={busy} className="btn-primary flex-1" style={{ minHeight: 44 }}>
          {isPremium ? <Share2 size={15} /> : <Lock size={14} />}
          {busy ? "Working…" : "Share my card"}
        </button>
        <button onClick={handleSave} disabled={busy} className="btn-secondary" style={{ minHeight: 44 }}>
          {isPremium ? <Download size={15} /> : <Lock size={13} />}
          Save
        </button>
      </div>

      {!isPremium && (
        <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
          HD export + share unlocks with the All-SZN Pass — get seen by coaches in full resolution.
        </p>
      )}
      {note && <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>{note}</p>}

      <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}