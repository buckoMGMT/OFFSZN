import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Video, Upload, CheckCircle, Lock, Star, X } from "lucide-react";

export default function CoachTier({ athlete, onUpdate }) {
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", video_url: "", sport: "", position: "", category: "tutorial", difficulty: "intermediate" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const approvedCount = athlete?.approved_video_count || 0;
  const totalViews = athlete?.total_video_views || 0;
  const isCoach = athlete?.is_coach_verified;
  const coachUnlocked = approvedCount >= 10 && totalViews >= 5000;

  const submit = async () => {
    if (!form.title || !form.video_url) return;
    setSubmitting(true);
    await base44.entities.UserVideoSubmission.create({
      athlete_id: athlete.id,
      title: form.title,
      description: form.description,
      video_url: form.video_url,
      sport: form.sport || undefined,
      position: form.position || undefined,
      category: form.category,
      difficulty: form.difficulty,
      status: "pending",
      likes: 0,
      views: 0,
    });
    setSubmitting(false);
    setSubmitted(true);
    setShowUpload(false);
    setForm({ title: "", description: "", video_url: "", sport: "", position: "", category: "tutorial", difficulty: "intermediate" });
    if (onUpdate) onUpdate();
  };

  return (
    <div className="space-y-3">
      {/* Coach Status Card */}
      <div className={`rounded-xl border p-4 ${isCoach ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star size={16} className={isCoach ? "text-primary" : "text-muted-foreground"} />
            <span className="text-sm font-semibold text-foreground">
              {isCoach ? "Verified Coach ✓" : "Coach Tier"}
            </span>
          </div>
          {!isCoach && coachUnlocked && (
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">Eligible!</span>
          )}
        </div>

        {/* Progress */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-secondary rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-foreground">{approvedCount}<span className="text-xs text-muted-foreground font-normal">/10</span></p>
            <p className="text-[10px] text-muted-foreground">Approved Videos</p>
          </div>
          <div className="bg-secondary rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-foreground">
              {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews}
              <span className="text-xs text-muted-foreground font-normal">/5K</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Total Views</p>
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-1.5 mb-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (approvedCount / 10) * 100)}%` }} />
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (totalViews / 5000) * 100)}%` }} />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {isCoach
            ? "You earn 70% of revenue on your approved training videos."
            : coachUnlocked
            ? "You've hit the threshold! Your Coach badge is being reviewed."
            : "Upload 10 approved videos with 5,000+ total views to unlock Coach Tier and earn revenue from your content."}
        </p>
      </div>

      {/* Upload Button */}
      {submitted ? (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/30 rounded-xl">
          <CheckCircle size={16} className="text-primary" />
          <p className="text-sm text-primary font-medium">Submitted for review!</p>
        </div>
      ) : (
        <button onClick={() => setShowUpload(!showUpload)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition-colors">
          <Video size={15} /> Upload Training Video
        </button>
      )}

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Submit Video</p>
            <button onClick={() => setShowUpload(false)}><X size={14} className="text-muted-foreground" /></button>
          </div>
          <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Title *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="YouTube or Vimeo URL *" value={form.video_url} onChange={e => setForm(p => ({ ...p, video_url: e.target.value }))} />
          <textarea className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-16"
            placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Sport" value={form.sport} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))} />
            <input className="bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Position" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select className="bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
              value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="workout">Workout</option>
              <option value="tutorial">Tutorial</option>
              <option value="form_check">Form Check</option>
              <option value="progress">Progress</option>
              <option value="challenge">Challenge</option>
            </select>
            <select className="bg-secondary rounded-xl px-3 py-2.5 text-sm text-foreground outline-none"
              value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground">Videos are reviewed before going live. Allow 24–48 hrs.</p>
          <button onClick={submit} disabled={submitting || !form.title || !form.video_url}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            <Upload size={14} /> {submitting ? "Submitting…" : "Submit for Review"}
          </button>
        </div>
      )}
    </div>
  );
}