import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Play, Pin, Upload, Video } from "lucide-react";

function getYtId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function HighlightReel({ athlete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(athlete?.highlight_url || "");
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Upload a clip from the device camera roll (native permission prompt on mobile)
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Athlete.update(athlete.id, { highlight_url: file_url });
    setUploading(false);
    setEditing(false);
    setPlaying(false);
    if (onUpdate) onUpdate();
  };

  const save = async () => {
    setSaving(true);
    await base44.entities.Athlete.update(athlete.id, { highlight_url: url });
    setEditing(false);
    setSaving(false);
    setPlaying(false);
    if (onUpdate) onUpdate();
  };

  const ytId = getYtId(athlete?.highlight_url);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Pin size={14} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Pinned Highlight</h3>
        </div>
        <button onClick={() => setEditing(!editing)} className="text-xs text-primary font-medium">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div className="p-4 space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px dashed var(--accent)' }}
          >
            <Video size={15} />
            {uploading ? "Uploading…" : "Upload from camera roll"}
          </button>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={handleFile} />
          <p className="text-center text-xs text-muted-foreground">— or —</p>
          <input
            type="text"
            placeholder="Paste YouTube link (e.g. dunking, big play…)"
            className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground outline-none"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
          >
            {saving ? "Saving…" : "Pin This Highlight"}
          </button>
        </div>
      ) : athlete?.highlight_url ? (
        <div className="relative aspect-video bg-black">
          {!ytId ? (
            <video src={athlete.highlight_url} controls playsInline className="w-full h-full object-contain" />
          ) : playing ? (
            <iframe
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          ) : (
            <button onClick={() => setPlaying(true)} className="w-full h-full relative flex items-center justify-center group">
              {ytId && (
                <img
                  src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                  alt="highlight thumbnail"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
              )}
              <div className="w-16 h-16 bg-primary/90 rounded-full flex items-center justify-center z-10 group-hover:scale-110 transition-transform">
                <Play size={28} className="text-primary-foreground ml-1" fill="currentColor" />
              </div>
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full p-8 flex flex-col items-center gap-2 text-center"
        >
          <Upload size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Pin your best play</p>
          <p className="text-xs text-muted-foreground/60">Dunks, touchdowns, big lifts — show your game</p>
        </button>
      )}
    </div>
  );
}