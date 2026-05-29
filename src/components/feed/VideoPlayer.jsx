import { useState } from "react";
import { Play } from "lucide-react";

function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Direct video file
  return url;
}

function isDirectVideo(url) {
  return url && (url.includes('.mp4') || url.includes('.webm') || url.includes('.mov'));
}

export default function VideoPlayer({ url }) {
  const [playing, setPlaying] = useState(false);
  if (!url) return null;

  const embedUrl = getEmbedUrl(url);
  const direct = isDirectVideo(url);

  if (direct) {
    return (
      <div className="rounded-xl overflow-hidden bg-black aspect-video mt-3">
        <video src={url} controls className="w-full h-full" />
      </div>
    );
  }

  if (!playing) {
    return (
      <button
        onClick={() => setPlaying(true)}
        className="w-full rounded-xl overflow-hidden bg-black aspect-video mt-3 flex items-center justify-center relative group"
      >
        <img
          src={`https://img.youtube.com/vi/${url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]}/hqdefault.jpg`}
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="w-14 h-14 bg-primary/90 rounded-full flex items-center justify-center z-10 group-hover:scale-110 transition-transform gold-glow">
          <Play size={24} className="text-primary-foreground ml-1" fill="currentColor" />
        </div>
      </button>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden aspect-video mt-3">
      <iframe
        src={embedUrl + "?autoplay=1"}
        className="w-full h-full"
        allow="autoplay; encrypted-media"
        allowFullScreen
      />
    </div>
  );
}