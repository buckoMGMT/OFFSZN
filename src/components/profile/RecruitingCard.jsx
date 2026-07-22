// Shareable player card — the core viral loop. Real data only.
// Athlete card = performance (up to 6 stats — ONLY what exists; 2 stats = 2 big cells).
// Coach card = credibility + services — never grade/position/body stats.
// ZERO truncation: name auto-scales, meta wraps. Nothing on the card ellipsizes.
// Verified shield = logged/tested data ONLY. Subscription is never "verified".
import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import { Share2, Download, Lock, ShieldCheck } from "lucide-react";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";

const IN = (n) => (n ? `${Math.floor(n / 12)}'${n % 12}"` : null);
const MILE = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : null);

function StatCell({ label, value, verified, big }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-3">
      <div className="flex items-center gap-1">
        <span style={{ fontFamily: "'Archivo Black', sans-serif", fontVariantNumeric: "tabular-nums", fontSize: big ? 28 : 20, color: "#fff", lineHeight: 1 }}>{value}</span>
        {verified && <ShieldCheck size={big ? 13 : 11} style={{ color: "#2FBF71", flexShrink: 0 }} />}
      </div>
      <span style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginTop: 5 }}>{label}</span>
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
  const isCoach = athlete.role === "coach";
  const streak = athlete.current_streak_days || 0;
  const points = athlete.total_points || 0;

  const name = (athlete.display_name || "Athlete").toUpperCase();
  // Auto-scale so long names NEVER truncate
  const nameSize = name.length <= 12 ? 22 : name.length <= 18 ? 18 : 15;

  // Identity meta — height/weight are identity, not performance; they live here.
  const identity = isCoach
    ? [
        athlete.sport ? `${athlete.sport.replace(/_/g, " ")} coach` : "coach",
        athlete.coach_years_experience ? `${athlete.coach_years_experience} yrs` : null,
        ...(athlete.coach_levels_coached || []).slice(0, 3).map((l) => l.replace(/_/g, " ")),
      ].filter(Boolean)
    : [
        athlete.sport?.replace(/_/g, " "),
        athlete.position,
        athlete.grade,
        IN(athlete.height_inches),
        athlete.weight_lbs ? `${athlete.weight_lbs} lbs` : null,
        athlete.gpa ? `${athlete.gpa.toFixed(1)} GPA` : null,
        athlete.hometown || null,
      ].filter(Boolean);

  // Performance grid — only stats that exist. A day-one athlete leads with STREAK + PTS.
  const stats = isCoach
    ? [
        { label: "Yrs Exp", value: athlete.coach_years_experience },
        { label: "Videos", value: athlete.approved_video_count || null, verified: !!athlete.approved_video_count },
        { label: "Views", value: athlete.total_video_views ? athlete.total_video_views.toLocaleString() : null, verified: !!athlete.total_video_views },
      ].filter((s) => s.value)
    : [
        { label: "Bench", value: athlete.bench_press_lbs, verified: verifiedFlags.bench_press_lbs },
        { label: "Squat", value: athlete.squat_lbs, verified: verifiedFlags.squat_lbs },
        { label: "Deadlift", value: athlete.deadlift_lbs, verified: verifiedFlags.deadlift_lbs },
        { label: "Mile", value: MILE(athlete.mile_time_seconds), verified: verifiedFlags.mile_time_seconds },
        // Combine-style recruiting metrics — what NCAA recruiters actually scan for
        { label: "40 YD", value: athlete.forty_yd_seconds ? `${athlete.forty_yd_seconds}s` : null, verified: verifiedFlags.forty_yd_seconds },
        { label: "Vert", value: athlete.vertical_jump_inches ? `${athlete.vertical_jump_inches}"` : null, verified: verifiedFlags.vertical_jump_inches },
        // Streak & points are system-logged data — always verified.
        { label: "Streak", value: streak > 0 ? streak : null, verified: streak > 0 },
        { label: "Pts", value: points > 0 ? points.toLocaleString() : null, verified: points > 0 },
      ].filter((s) => s.value).slice(0, 6);

  const cols = Math.min(Math.max(stats.length, 1), 3);
  const big = stats.length <= 3;
  const anyVerified = stats.some((s) => s.verified) || (!isCoach && verifiedFlags.weight_lbs && athlete.weight_lbs);

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

        {/* Jersey number — real, from the profile. Hidden when unset so the card
            never shows a fake number. */}
        {!isCoach && athlete.jersey_number && (
          <span style={{ position: "absolute", top: 16, right: 14, fontFamily: "'Archivo Black', sans-serif", fontSize: 54, lineHeight: 1, color: "rgba(255,90,31,0.15)", letterSpacing: "-0.02em", pointerEvents: "none" }}>
            {String(athlete.jersey_number).slice(0, 3)}
          </span>
        )}

        <div className="relative p-4">
          {/* Identity row — nothing here may ellipsize; meta wraps to two lines */}
          <div className="flex items-start gap-3 mb-3" style={{ paddingRight: 48 }}>
            <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#23272C", border: "2px solid var(--accent)" }}>
              {athlete.avatar_url
                ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
                : <span style={{ fontFamily: "'Archivo Black', sans-serif", color: "var(--accent)", fontSize: 22 }}>{name[0]}</span>}
            </div>
            <div className="min-w-0" style={{ paddingTop: 2 }}>
              <p style={{ fontFamily: "'Archivo Black', sans-serif", textTransform: "uppercase", color: "#fff", fontSize: nameSize, lineHeight: 1.1, wordBreak: "break-word" }}>{name}</p>
              <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: 3, lineHeight: 1.5 }}>
                {identity.join(" · ")}
                {!isCoach && verifiedFlags.weight_lbs && athlete.weight_lbs
                  ? <ShieldCheck size={9} style={{ color: "#2FBF71", display: "inline", marginLeft: 3, verticalAlign: "-1px" }} />
                  : null}
              </p>
              {athlete.school && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{athlete.school}</p>}
            </div>
          </div>

          {/* Coach credibility — identity verification only, never subscription */}
          {isCoach && athlete.is_coach_verified && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded mb-3" style={{ background: "rgba(47,191,113,0.12)", border: "1px solid #2FBF71" }}>
              <ShieldCheck size={11} style={{ color: "#2FBF71" }} />
              <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#2FBF71", fontWeight: 600 }}>Verified Coach</span>
            </div>
          )}
          {isCoach && (athlete.coach_specialties || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {athlete.coach_specialties.slice(0, 4).map((s) => (
                <span key={s} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", padding: "3px 8px", borderRadius: 6 }}>{s}</span>
              ))}
            </div>
          )}

          {/* Stat grid — jersey-back energy. Cells scale up when fewer stats exist. */}
          {stats.length > 0 && (
            <div className="grid rounded-lg mb-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {stats.map((s) => <StatCell key={s.label} label={s.label} value={s.value} verified={s.verified} big={big} />)}
            </div>
          )}

          {/* Coach services line */}
          {isCoach && athlete.coach_sub_price_usd > 0 && (
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              1-on-1 coaching · ${athlete.coach_sub_price_usd}/mo
            </p>
          )}

          {/* Verified legend — only when at least one verified number exists */}
          {anyVerified && (
            <div className="flex items-center gap-1 mb-2">
              <ShieldCheck size={10} style={{ color: "#2FBF71" }} />
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Verified from logged / tested data</span>
            </div>
          )}

          {/* Branded footer — every share is a growth touch */}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 11, color: "var(--accent)", letterSpacing: "0.04em" }}>OFFSZN</span>
            <span className="flex items-center gap-2">
              {!isPremium && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)" }}>
                  <Lock size={8} style={{ color: "rgba(255,255,255,0.6)" }} />
                  <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)" }}>Basic</span>
                </span>
              )}
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>Built on OFFSZN — offsznapp.com</span>
            </span>
          </div>
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