import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X } from "lucide-react";
import StampButton from "@/components/ui/StampButton";
import TeamEmblemUpload from "@/components/clans/TeamEmblemUpload";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "other"];
const TYPES = ["high_school", "club", "college", "other"];

// Admin-only editor for team identity: emblem, name, school, type, sport, description.
export default function EditTeamModal({ clan, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: clan.name || "",
    school_name: clan.school_name || "",
    location: clan.location || "",
    type: clan.type || "high_school",
    sport: clan.sport || "football",
    description: clan.description || "",
    emblem_url: clan.emblem_url || "",
    banner_url: clan.banner_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!form.name.trim()) { setError("Team name is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const updated = await base44.entities.Clan.update(clan.id, {
        name: form.name.trim(),
        school_name: form.school_name.trim(),
        location: form.location.trim(),
        type: form.type,
        sport: form.sport,
        description: form.description.trim(),
        emblem_url: form.emblem_url,
        banner_url: form.banner_url,
      });
      onSaved(updated);
    } catch {
      setError("Couldn't save your changes — try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--theme-ink)' }}>Edit Team</h2>
          <button onClick={onClose} className="p-2 rounded" style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }} aria-label="Close">
            <X size={18} style={{ color: 'var(--theme-ink-soft)' }} />
          </button>
        </div>
        <div className="space-y-4">
          <TeamEmblemUpload emblemUrl={form.emblem_url} onUploaded={(url) => setForm(p => ({ ...p, emblem_url: url }))} />
          <TeamEmblemUpload aspect="banner" label="Team Banner" emblemUrl={form.banner_url} onUploaded={(url) => setForm(p => ({ ...p, banner_url: url }))} />
          {[
            { placeholder: "Team name *", field: "name" },
            { placeholder: "School / Organization", field: "school_name" },
            { placeholder: "Location (City, ST)", field: "location" },
          ].map(({ placeholder, field }) => (
            <input key={field} className="w-full rounded px-4 py-3 text-sm font-work outline-none"
              style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
              placeholder={placeholder} value={form[field]}
              onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
          ))}
          <div>
            <p className="eyebrow mb-2">Team Type</p>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))}
                  className="px-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={form.type === t
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                    : { background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
                  {t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-2">Sport</p>
            <div className="flex flex-wrap gap-2">
              {SPORTS.map(s => (
                <button key={s} onClick={() => setForm(p => ({ ...p, sport: s }))}
                  className="px-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={form.sport === s
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                    : { background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <textarea className="w-full rounded px-4 py-3 text-sm font-work outline-none resize-none h-20"
            style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
            placeholder="Description (optional)" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        {error && <p className="text-xs mt-3 text-center" style={{ color: 'var(--negative)' }}>{error}</p>}
        <div className="mt-6 flex justify-center">
          <StampButton onClick={save} disabled={saving} className="text-base px-8 py-3">
            {saving ? "Saving…" : "Save Changes"}
          </StampButton>
        </div>
      </div>
    </div>
  );
}