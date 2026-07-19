import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Camera } from "lucide-react";

// Tappable avatar — opens the device photo library / camera (native
// permission prompt on mobile), uploads, and saves to the athlete card.
export default function AvatarUpload({ athlete, onUpdated, editable = false }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Athlete.update(athlete.id, { avatar_url: file_url });
    setUploading(false);
    onUpdated?.();
  };

  return (
    <button
      type="button"
      onClick={() => editable && inputRef.current?.click()}
      className="relative w-16 h-16 rounded border-2 flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)', opacity: uploading ? 0.6 : 1 }}
      aria-label="Change profile picture"
    >
      {athlete.avatar_url
        ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className="font-anton text-2xl" style={{ color: 'var(--accent)' }}>{(athlete.display_name || "A")[0].toUpperCase()}</span>
      }
      {/* Camera badge — edit mode only; the display profile stays clean */}
      {editable && (
        <span
          className="absolute bottom-0 right-0 flex items-center justify-center"
          style={{ width: 20, height: 20, background: 'var(--accent)', borderTopLeftRadius: 6 }}
        >
          <Camera size={11} style={{ color: 'var(--on-accent)' }} />
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </button>
  );
}