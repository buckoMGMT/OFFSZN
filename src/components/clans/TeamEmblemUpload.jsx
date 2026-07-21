import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, Camera, Loader2 } from "lucide-react";

// Square team emblem/photo uploader. Shows the current emblem (or a shield
// placeholder) with a camera badge; uploads to storage and returns the url.
export default function TeamEmblemUpload({ emblemUrl, onUploaded, size = 72 }) {
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
        <p className="eyebrow mb-0.5">Team Emblem</p>
        <button type="button" onClick={pick} className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          {emblemUrl ? "Change photo" : "Add photo"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}