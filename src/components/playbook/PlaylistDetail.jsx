// Full-screen playlist view — Apple Music / Spotify pattern.
// View the tracklist, play all, open a program, edit (name / icon / contents), delete.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Play, Pencil, Trash2, Clock, Check, Minus, Plus } from "lucide-react";
import { PLAYLIST_ICONS, PlaylistIcon, DEFAULT_PLAYLIST_ICON } from "@/components/playbook/playlistIcons";
import useSheetBack from "@/lib/useSheetBack";

export default function PlaylistDetail({ playlist, allPrograms, onClose, onPlay, onOpenProgram, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [icon, setIcon] = useState(playlist.icon || DEFAULT_PLAYLIST_ICON);
  const [programIds, setProgramIds] = useState(playlist.program_ids || []);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useSheetBack(true, onClose);

  const tracks = programIds.map(id => allPrograms.find(p => p.id === id)).filter(Boolean);
  const totalMin = tracks.reduce((s, p) => s + p.duration, 0);
  const notIncluded = allPrograms.filter(p => !programIds.includes(p.id));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updated = await base44.entities.Playlist.update(playlist.id, { name: name.trim(), icon, program_ids: programIds });
    setSaving(false);
    setEditing(false);
    onSaved?.(updated);
  };

  const remove = async () => {
    await base44.entities.Playlist.delete(playlist.id);
    onDeleted?.(playlist.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 flex-shrink-0" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))', paddingBottom: 12 }}>
        <button onClick={onClose} className="p-2 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
          <X size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-2">
          {editing ? (
            <button onClick={save} disabled={saving || !name.trim()} className="flex items-center gap-1 px-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
              <Check size={12} /> {saving ? "Saving…" : "Done"}
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <Pencil size={11} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        {/* Cover block — big icon, name, meta */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-28 h-28 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
            <PlaylistIcon name={icon} size={52} />
          </div>
          {editing ? (
            <input className="w-full max-w-xs rounded px-4 py-2.5 text-center font-anton text-lg uppercase outline-none"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
              value={name} onChange={e => setName(e.target.value)} placeholder="Playlist name" />
          ) : (
            <h1 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>{playlist.name}</h1>
          )}
          <p className="font-elite text-[10px] uppercase tracking-widest mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
            {tracks.length} program{tracks.length === 1 ? "" : "s"} · <Clock size={9} /> {totalMin} min
          </p>
        </div>

        {/* Icon picker — edit mode only */}
        {editing && (
          <div className="mb-5">
            <p className="eyebrow mb-2">Playlist Icon</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {Object.keys(PLAYLIST_ICONS).map(key => (
                <button key={key} onClick={() => setIcon(key)}
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: icon === key ? 'var(--accent-subtle)' : 'var(--surface-1)',
                    border: icon === key ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                  }}>
                  <PlaylistIcon name={key} size={20} color={icon === key ? 'var(--accent)' : 'var(--text-secondary)'} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Play all */}
        {!editing && tracks.length > 0 && (
          <button className="btn-primary w-full mb-5" onClick={() => onPlay(tracks)}>
            <Play size={14} fill="currentColor" /> Play All
          </button>
        )}

        {/* Tracklist */}
        <p className="eyebrow mb-2">Programs</p>
        {tracks.length === 0 && (
          <p className="font-work text-sm py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
            Empty playlist. {editing ? "Add programs below." : "Tap Edit to add programs."}
          </p>
        )}
        <div className="space-y-2 mb-6">
          {tracks.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded border"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
              <span className="tabular-nums text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{i + 1}</span>
              <img src={p.cover} alt="" className="w-11 h-11 rounded object-cover flex-shrink-0" />
              <button className="flex-1 min-w-0 text-left" onClick={() => !editing && onOpenProgram(p)}>
                <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{p.sport} · {p.duration}m</p>
              </button>
              {editing ? (
                <button onClick={() => setProgramIds(prev => prev.filter(id => id !== p.id))}
                  className="p-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
                  <Minus size={13} style={{ color: 'var(--negative)' }} />
                </button>
              ) : (
                <button onClick={() => onPlay([p])} className="p-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                  <Play size={12} fill="var(--accent)" style={{ color: 'var(--accent)' }} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add programs — edit mode only */}
        {editing && notIncluded.length > 0 && (
          <>
            <p className="eyebrow mb-2">Add Programs</p>
            <div className="space-y-2 mb-6">
              {notIncluded.map(p => (
                <button key={p.id} onClick={() => setProgramIds(prev => [...prev, p.id])}
                  className="w-full flex items-center gap-3 p-2.5 rounded border text-left"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
                  <img src={p.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                    <p className="font-elite text-[9px] uppercase" style={{ color: 'var(--text-tertiary)' }}>{p.duration}m</p>
                  </div>
                  <Plus size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Delete — edit mode, two-tap confirm */}
        {editing && (
          <button onClick={() => confirmDelete ? remove() : setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded font-elite text-[10px] uppercase tracking-widest mb-4"
            style={{ background: confirmDelete ? 'var(--negative)' : 'transparent', border: '1px solid var(--negative)', color: confirmDelete ? '#fff' : 'var(--negative)' }}>
            <Trash2 size={12} /> {confirmDelete ? "Tap again to delete for good" : "Delete Playlist"}
          </button>
        )}
      </div>
    </div>
  );
}