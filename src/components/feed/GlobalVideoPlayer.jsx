// The single app-wide video surface. Full-screen when open; a draggable,
// corner-snapping floating card when minimized. One <video> element the whole
// time → audio continues through minimize/restore and never double-plays.
// Dock-aware: the mini-card's snap zones sit above the bottom nav.
import { useRef, useState, useEffect, useCallback } from "react";
import { X, Minimize2, PictureInPicture2 } from "lucide-react";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";

// Convert a YouTube URL to an embed; return null for direct video files.
function youtubeEmbed(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&playsinline=1` : null;
}

const MARGIN = 12;
const DOCK_H = 76; // keep the mini-card clear of the bottom nav + safe area

export default function GlobalVideoPlayer() {
  const { video, minimized, minimize, restore, close } = useMiniPlayer();
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // top-left of mini-card
  const drag = useRef(null);

  const isYouTube = video ? !!youtubeEmbed(video.url) : false;
  const embed = video ? youtubeEmbed(video.url) : null;

  // Mini-card dimensions (~38% width, 16:9)
  const cardW = Math.min(Math.round(window.innerWidth * 0.38), 220);
  const cardH = Math.round(cardW * 9 / 16);

  const snapToCorner = useCallback((x, y) => {
    const maxX = window.innerWidth - cardW - MARGIN;
    const maxY = window.innerHeight - cardH - DOCK_H - MARGIN;
    const left = x + cardW / 2 < window.innerWidth / 2;
    const top = y + cardH / 2 < window.innerHeight / 2;
    return { x: left ? MARGIN : maxX, y: top ? MARGIN + 56 : maxY };
  }, [cardW, cardH]);

  // On first minimize, drop into the bottom-right corner
  useEffect(() => {
    if (minimized) setPos(snapToCorner(window.innerWidth, window.innerHeight));
  }, [minimized, snapToCorner]);

  const onPointerDown = (e) => {
    if (!minimized) return;
    const p = e.touches ? e.touches[0] : e;
    drag.current = { dx: p.clientX - pos.x, dy: p.clientY - pos.y, moved: false };
  };
  const onPointerMove = useCallback((e) => {
    if (!drag.current) return;
    const p = e.touches ? e.touches[0] : e;
    drag.current.moved = true;
    setPos({ x: p.clientX - drag.current.dx, y: p.clientY - drag.current.dy });
  }, []);
  const onPointerUp = useCallback((e) => {
    if (!drag.current) return;
    const moved = drag.current.moved;
    // Swipe-away: flung far right past the edge → dismiss
    const p = e.changedTouches ? e.changedTouches[0] : e;
    if (p.clientX > window.innerWidth - 20 && moved) { drag.current = null; close(); return; }
    setPos((cur) => snapToCorner(cur.x, cur.y));
    // A tap (no move) restores
    if (!moved) restore();
    drag.current = null;
  }, [snapToCorner, restore, close]);

  useEffect(() => {
    if (!minimized) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [minimized, onPointerMove, onPointerUp]);

  const requestPiP = async () => {
    if (videoRef.current?.requestPictureInPicture) {
      try { await videoRef.current.requestPictureInPicture(); } catch { /* denied */ }
    }
  };

  if (!video) return null;

  // The actual media element — rendered ONCE, reparented visually via wrapper styles
  const media = isYouTube ? (
    <iframe
      src={embed}
      title={video.title}
      className="w-full h-full"
      style={{ border: 0 }}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  ) : (
    <video
      ref={videoRef}
      src={video.url}
      controls={!minimized}
      autoPlay
      playsInline
      className="w-full h-full object-contain bg-black"
    />
  );

  if (minimized) {
    return (
      <div
        ref={cardRef}
        onPointerDown={onPointerDown}
        className="fixed z-[120] rounded-lg overflow-hidden overlay-shadow"
        style={{ left: pos.x, top: pos.y, width: cardW, height: cardH, background: '#000', border: '1px solid var(--border-strong)', touchAction: 'none', cursor: 'grab' }}
      >
        {media}
        <button
          onClick={(e) => { e.stopPropagation(); close(); }}
          className="absolute top-1 right-1 p-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <X size={12} style={{ color: '#fff' }} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <div className="min-w-0 flex-1">
          <p className="font-work text-sm font-semibold truncate" style={{ color: '#fff' }}>{video.title}</p>
          {video.author && <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.6)' }}>{video.author}</p>}
        </div>
        <div className="flex items-center gap-1">
          {!isYouTube && document.pictureInPictureEnabled && (
            <button onClick={requestPiP} className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Picture in picture">
              <PictureInPicture2 size={16} style={{ color: '#fff' }} />
            </button>
          )}
          <button onClick={minimize} className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Minimize">
            <Minimize2 size={16} style={{ color: '#fff' }} />
          </button>
          <button onClick={close} className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Close">
            <X size={16} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-2">
        <div className="w-full" style={{ aspectRatio: '16 / 9', maxHeight: '70vh' }}>{media}</div>
      </div>
    </div>
  );
}