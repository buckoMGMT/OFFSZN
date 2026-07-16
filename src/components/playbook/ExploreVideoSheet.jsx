// Bottom sheet video player for explore-grid drills.
import { useState, useEffect } from "react";
import { X, BadgeCheck, Flag } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";
import ReportSheet from "@/components/safety/ReportSheet";
import useSheetBack from "@/lib/useSheetBack";

export default function ExploreVideoSheet({ open, onClose, video, author }) {
  const [showReport, setShowReport] = useState(false);
  // §4 — back gesture / hardware back dismisses this sheet first
  useSheetBack(open, onClose);
  // Server-side view counting, throttled to one per user per drill per day.
  useEffect(() => {
    if (open && video?.id) base44.functions.invoke("drillEngagement", { drillId: video.id, kind: "view" }).catch(() => {});
  }, [open, video?.id]);
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
        <button onClick={() => setShowReport(true)}
          className="w-full flex items-center justify-center gap-1.5 mt-4 py-2 font-elite text-[9px] uppercase tracking-widest"
          style={{ color: 'var(--text-tertiary)' }}>
          <Flag size={10} /> Report this video
        </button>
        <ReportSheet open={showReport} onClose={() => setShowReport(false)} targetType="video" targetId={video.id} />
      </div>
    </div>
  );
}