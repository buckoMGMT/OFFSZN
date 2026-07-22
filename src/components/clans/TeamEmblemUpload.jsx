import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Camera, Loader2 } from "lucide-react";

// Team image uploader. Square (emblem) by default; aspect="banner" renders a
// full-width wide picker. Uploads to storage and returns the url.
export default function TeamEmblemUpload({ emblemUrl, onUploaded, size = 72, label = "Team Emblem", aspect = "square" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onUploaded(file_url);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (aspect === "banner") {
    return (
      <div>
        <p className="eyebrow mb-2">{label}</p>
        <button type="button" onClick={pick} className="relative w-full rounded flex items-center justify-center overflow-hidden"
          style={{ height: 80, background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
          {emblemUrl ? (
            <img src={emblemUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Add a wide banner photo</span>
          )}
          <span className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)', border: '2px solid var(--surface-0)' }}>
            {uploading ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--on-accent)' }} />
              : <Camera size={12} style={{ color: 'var(--on-accent)' }} />}
          </span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={pick} className="relative rounded flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
        {emblemUrl ? (
          <img src={emblemUrl} alt="" className="w-full h-full rounded object-cover" />
        ) : (
          <Shield size={size * 0.4} style={{ color: 'var(--text-tertiary)' }} />
        )}
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: 'var(--accent)', border: '2px solid var(--surface-0)' }}>
          {uploading ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--on-accent)' }} />
            : <Camera size={12} style={{ color: 'var(--on-accent)' }} />}
        </span>
      </button>
      <div>
        <p className="eyebrow mb-0.5">{label}</p>
        <button type="button" onClick={pick} className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          {emblemUrl ? "Change photo" : "Add photo"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}