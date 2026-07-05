// Bottom sheet video player for explore-grid drills.
import { X, BadgeCheck } from "lucide-react";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";

export default function ExploreVideoSheet({ open, onClose, video, author }) {
  if (!open || !video) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-5 animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="font-work text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{video.title}</h2>
            {author && (
              <span className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-wide mt-1" style={{ color: 'var(--text-secondary)' }}>
                {author.avatar_url && <img src={author.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
                {author.display_name}
                {author.is_coach_verified && <BadgeCheck size={11} style={{ color: 'var(--accent)' }} />}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded flex-shrink-0" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        {video.description && <p className="font-work text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{video.description}</p>}
        <ProtectedVideoPlayer url={video.video_url} />
      </div>
    </div>
  );
}