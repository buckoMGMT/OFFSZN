// Full-screen guided workout runner — one step at a time.
// Shared by program "Start Program" and playlist "Play" (one runner, one timer, one player).
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ChevronRight, CheckCircle, Share2 } from "lucide-react";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";
import Countdown from "@/components/workout/Countdown";
import { completeWorkout } from "@/lib/points";
import { useImmersiveDock } from "@/lib/DockContext";

const REST_SECONDS = 45;

export default function WorkoutRunner({ title, steps, athlete, durationMinutes, onClose }) {
  useImmersiveDock(); // §1 — dock hidden while the runner is open, restored on exit
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState("work"); // work | rest | saving | done
  const [result, setResult] = useState(null);
  const [shared, setShared] = useState(false);
  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = async () => {
    setPhase("saving");
    const r = await completeWorkout(athlete, title, durationMinutes);
    setResult(r);
    setPhase("done");
  };

  const next = () => { last ? finish() : setPhase("rest"); };
  const afterRest = () => { setIndex(i => i + 1); setPhase("work"); };

  const share = async () => {
    await base44.entities.SocialPost.create({
      athlete_id: athlete.id,
      athlete_name: athlete.display_name,
      athlete_avatar: athlete.avatar_url,
      type: "workout_complete",
      content: `Just put in work: ${title}. Logged and counted.`,
      status: "approved",
    });
    setShared(true);
  };

  const progressPct = phase === "done" || phase === "saving"
    ? 100
    : ((index + (phase === "rest" ? 1 : 0)) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--surface-0)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header + progress */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">{phase === "done" || phase === "saving" ? "Session Complete" : `Step ${index + 1} of ${steps.length}`}</p>
          <button onClick={onClose} className="p-2 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'var(--accent)', transition: 'width var(--dur-base) var(--ease-out)' }} />
        </div>
        <p className="font-anton text-lg uppercase mt-3" style={{ color: 'var(--text-primary)' }}>{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {phase === "work" && (
          <div className="space-y-4">
            <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>{step.name}</h2>
            {step.video_url && <ProtectedVideoPlayer url={step.video_url} />}
            {step.sets && step.reps && (
              <div className="card-base p-4 text-center">
                <p className="eyebrow mb-1">Target</p>
                <p className="stat-number" style={{ fontSize: 'var(--text-4xl)' }}>{step.sets} × {step.reps}</p>
              </div>
            )}
            {step.duration_seconds && (
              <div className="card-base p-6">
                <Countdown key={`work-${index}`} seconds={step.duration_seconds} label="Work" onDone={next} />
              </div>
            )}
            {step.note && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step.note}</p>}
          </div>
        )}

        {phase === "rest" && (
          <div className="card-base p-8 mt-8">
            <Countdown key={`rest-${index}`} seconds={REST_SECONDS} autoStart
              label={`Rest — Up Next: ${steps[index + 1]?.name || ""}`} onDone={afterRest} />
          </div>
        )}

        {phase === "saving" && (
          <div className="space-y-4 mt-10">
            <div className="skeleton mx-auto" style={{ width: 72, height: 72, borderRadius: 'var(--r-full)' }} />
            <div className="skeleton mx-auto" style={{ width: '60%', height: 24 }} />
            <div className="skeleton mx-auto" style={{ width: '40%', height: 14 }} />
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center text-center mt-8 gap-4">
            <CheckCircle size={56} style={{ color: 'var(--positive)' }} />
            <h2 className="font-anton text-3xl uppercase" style={{ color: 'var(--text-primary)' }}>Program Complete</h2>
            <div className="flex gap-3">
              <div className="card-base px-5 py-3">
                <p className="eyebrow mb-1">Points</p>
                <p className="stat-number" style={{ fontSize: 'var(--text-2xl)', color: 'var(--accent)' }}>+{result?.awarded ?? 0}</p>
                {result?.awarded === 0 && <p className="text-[9px] mt-1" style={{ color: 'var(--text-tertiary)' }}>Daily cap reached</p>}
              </div>
              <div className="card-base px-5 py-3">
                <p className="eyebrow mb-1">SZN Streak</p>
                <p className="stat-number" style={{ fontSize: 'var(--text-2xl)' }}>{result?.streak ?? "--"}</p>
              </div>
            </div>
            <button onClick={share} disabled={shared} className="btn-secondary w-full" style={{ maxWidth: 320 }}>
              <Share2 size={13} /> {shared ? "Shared to The Field" : "Share to The Field"}
            </button>
            <button onClick={onClose} className="btn-primary w-full" style={{ maxWidth: 320 }}>Done</button>
          </div>
        )}
      </div>

      {phase === "work" && (
        <div className="px-5 pb-5">
          <button onClick={next} className="btn-primary w-full">
            {last ? "Finish Program" : "Next"} <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}