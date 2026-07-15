// Per-drill editor + new-drill upload (§2B). New drills and changed thumbnails
// go back through moderation (status: pending) before they're public.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Upload, ImagePlus } from "lucide-react";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "tennis", "softball", "cross_country", "general_fitness", "other"];
const DIFFICULTY = ["beginner", "intermediate", "advanced"];
const EQUIPMENT = [["full_gym", "Full gym"], ["home_gym", "Home gym"], ["bodyweight_only", "Bodyweight"]];

export default function DrillEditSheet({ open, onClose, drill, athlete, onSaved }) {
  const isNew = !drill;
  const [f, setF] = useState({});
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setVideoFile(null); setThumbFile(null); setError("");
    setF({
      title: drill?.title || "",
      caption: drill?.caption || "",
      tags: (drill?.tags || []).join(", "),
      sport: drill?.sport || athlete?.sport || "other",
      difficulty: drill?.difficulty || "intermediate",
      equipment_needed: drill?.equipment_needed || "full_gym",
      is_free: drill?.is_free ?? false,
    });
  }, [open, drill, athlete?.sport]);

  if (!open) return null;
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    const title = f.title.trim();
    if (title.length < 3 || title.length > 80) { setError("Title must be 3–80 characters."); return; }
    if (f.caption.length > 500) { setError("Caption is capped at 500 characters."); return; }
    if (isNew && !videoFile) { setError("Pick a video file to upload."); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        title,
        caption: f.caption.trim() || undefined,
        tags: f.tags.split(",").map(t => t.trim()).filter(Boolean),
        sport: f.sport,
        difficulty: f.difficulty,
        equipment_needed: f.equipment_needed,
        is_free: !!f.is_free,
      };
      if (thumbFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: thumbFile });
        payload.thumbnail_url = file_url;
        // Changed media goes back through moderation before it's public.
        payload.status = "pending";
        payload.moderation_notes = "Thumbnail updated — pending review";
      }
      if (isNew) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: videoFile });
        await base44.entities.UserVideoSubmission.create({
          ...payload, athlete_id: athlete.id, video_url: file_url, status: "pending",
        });
      } else {
        await base44.entities.UserVideoSubmission.update(drill.id, payload);
      }
      onSaved?.();
    } catch {
      setError("Couldn't save. Try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-5 animate-slide-up max-h-[88vh] overflow-y-auto"
        style={{ background: "var(--surface-0)", borderColor: "var(--border-subtle)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-anton text-lg uppercase" style={{ color: "var(--text-primary)" }}>{isNew ? "New Drill" : "Edit Drill"}</h2>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
            <X size={16} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-4">
          {isNew && (
            <label className="flex items-center gap-2 p-3 rounded cursor-pointer" style={{ background: "var(--surface-1)", border: "1px dashed var(--border-strong)" }}>
              <Upload size={14} style={{ color: "var(--accent)" }} />
              <span className="font-work text-xs" style={{ color: "var(--text-primary)" }}>{videoFile ? videoFile.name : "Choose video file"}</span>
              <input type="file" accept="video/*" className="hidden" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
            </label>
          )}

          <div>
            <span className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Title</span>
            <input className="input-base" value={f.title} maxLength={80} onChange={e => set("title", e.target.value)} />
          </div>

          <div>
            <span className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Caption <span className="tabular-nums text-xs" style={{ color: "var(--text-tertiary)" }}>({f.caption.length}/500)</span></span>
            <textarea className="input-base" style={{ minHeight: 80, paddingTop: 12 }} value={f.caption} maxLength={500} onChange={e => set("caption", e.target.value)} />
          </div>

          <div>
            <span className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Tags (comma separated)</span>
            <input className="input-base" value={f.tags} placeholder="footwork, agility, cone drill" onChange={e => set("tags", e.target.value)} />
          </div>

          <div>
            <span className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sport</span>
            <select className="input-base" value={f.sport} onChange={e => set("sport", e.target.value)}>
              {SPORTS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Difficulty</span>
            <div className="flex gap-2">
              {DIFFICULTY.map(d => (
                <button key={d} onClick={() => set("difficulty", d)}
                  className="px-3 py-1.5 rounded font-work text-[11px] font-semibold capitalize"
                  style={f.difficulty === d
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Equipment needed</span>
            <div className="flex gap-2">
              {EQUIPMENT.map(([v, l]) => (
                <button key={v} onClick={() => set("equipment_needed", v)}
                  className="px-3 py-1.5 rounded font-work text-[11px] font-semibold"
                  style={f.equipment_needed === v
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
            <div>
              <p className="font-work text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Free to watch</p>
              <p className="font-work text-[10px]" style={{ color: "var(--text-tertiary)" }}>Off = subscribers only</p>
            </div>
            <button onClick={() => set("is_free", !f.is_free)}
              className="w-11 h-6 rounded-full relative transition-colors"
              style={{ background: f.is_free ? "var(--accent)" : "var(--surface-3)" }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{ background: "var(--text-primary)", left: f.is_free ? 22 : 2 }} />
            </button>
          </div>

          <label className="flex items-center gap-2 p-3 rounded cursor-pointer" style={{ background: "var(--surface-1)", border: "1px dashed var(--border-strong)" }}>
            <ImagePlus size={14} style={{ color: "var(--accent)" }} />
            <span className="font-work text-xs" style={{ color: "var(--text-primary)" }}>
              {thumbFile ? thumbFile.name : drill?.thumbnail_url ? "Replace thumbnail" : "Upload custom thumbnail"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={e => setThumbFile(e.target.files?.[0] || null)} />
          </label>
          {thumbFile && (
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              New thumbnails go through review before they're public.
            </p>
          )}

          {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
          <button className="btn-primary w-full" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isNew ? "Submit for review" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}