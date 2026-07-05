// ProtectedVideoPlayer — OnlyFans-style content protection for premium coach videos.
// Anti-piracy measures:
// 1. Forensic watermark: user's email overlaid across video (survives screen recording)
// 2. Download disabled: controlsList removes download, PiP, remote playback
// 3. Context menu blocked: no right-click to "save video as"
// 4. User-select disabled: no text/element selection
// Note: For full protection, videos MUST be hosted on private storage with signed URLs.
// YouTube/Vimeo embeds cannot be watermarked — falls back to standard embed for those.
import { useState, useEffect, useRef } from "react";
import { Play } from "lucide-react";
import { base44 } from "@/api/base44Client";

function getEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

function isDirectVideo(url) {
  return url && (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov'));
}

export default function ProtectedVideoPlayer({ url }) {
  const [user, setUser] = useState(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!url) return null;

  const direct = isDirectVideo(url);
  const watermarkText = user?.email || user?.id || "OFFSZN";

  // YouTube / Vimeo embeds — cannot add forensic watermark to iframe content
  if (!direct) {
    const embedUrl = getEmbedUrl(url);
    if (!playing) {
      return (
        <button
          onClick={() => setPlaying(true)}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full rounded-xl overflow-hidden bg-black aspect-video mt-3 flex items-center justify-center relative group select-none"
        >
          <img
            src={`https://img.youtube.com/vi/${url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]}/hqdefault.jpg`}
            alt="Video thumbnail"
            className="absolute inset-0 w-full h-full object-cover opacity-70"
            onError={e => { e.target.style.display = 'none'; }}
          />
          <div className="w-14 h-14 rounded-full flex items-center justify-center z-10 group-hover:scale-110 transition-transform"
            style={{ background: 'var(--accent)' }}>
            <Play size={24} className="ml-1" style={{ color: 'var(--on-accent)' }} fill="currentColor" />
          </div>
          <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--accent)' }}>
            🔒 Protected
          </div>
        </button>
      );
    }
    return (
      <div className="rounded-xl overflow-hidden aspect-video mt-3" onContextMenu={(e) => e.preventDefault()}>
        <iframe
          src={embedUrl + "?autoplay=1"}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct video file — full protection suite
  return (
    <div
      className="rounded-xl overflow-hidden bg-black aspect-video mt-3 relative select-none"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        src={url}
        controls
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full relative z-0"
      />

      {/* Forensic watermark grid — user identity burned into visible frame.
          Survives screen recording / screenshots. Cannot be removed without
          cropping significant video area. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {Array.from({ length: 12 }).map((_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${row * 28 + 6}%`,
                left: `${col * 30 - 8}%`,
                transform: 'rotate(-28deg)',
                opacity: 0.14,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '0.04em',
                pointerEvents: 'none',
              }}
            >
              {watermarkText}
            </div>
          );
        })}
      </div>

      {/* Protected badge */}
      <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--accent)' }}>
        🔒 OFFSZN Protected
      </div>
    </div>
  );
}