import { useState } from "react";
import { Heart, MessageCircle, Trophy, Flame, Dumbbell, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import VideoPlayer from "@/components/feed/VideoPlayer";
import { motion } from "framer-motion";

const typeConfig = {
  achievement:      { icon: Trophy,   label: "PR",        stampColor: "var(--positive)" },
  macro_log:        { icon: Flame,    label: "Nutrition", stampColor: "var(--text-tertiary)" },
  workout_complete: { icon: Dumbbell, label: "Workout",   stampColor: "var(--text-tertiary)" },
  streak:           { icon: Zap,      label: "SZN Streak", stampColor: "var(--positive)" },
  clan_challenge:   { icon: Trophy,   label: "Challenge", stampColor: "var(--positive)" },
  weight_milestone: { icon: Trophy,   label: "Milestone", stampColor: "var(--positive)" },
};

export default function PostCard({ post, currentAthleteId, onUpdate }) {
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);

  const config = typeConfig[post.type] || typeConfig.achievement;
  const Icon = config.icon;
  const liked = (post.liked_by || []).includes(currentAthleteId);
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : "just now";

  const handleLike = async () => {
    const likedBy = post.liked_by || [];
    const newLikedBy = liked ? likedBy.filter(id => id !== currentAthleteId) : [...likedBy, currentAthleteId];
    await base44.entities.SocialPost.update(post.id, { likes: newLikedBy.length, liked_by: newLikedBy });
    onUpdate?.();
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setLoading(true);
    await base44.entities.SocialPost.update(post.id, {
      comments: [...(post.comments || []), {
        author_id: currentAthleteId,
        author_name: "You",
        text: commentText.trim(),
        created_at: new Date().toISOString(),
      }],
    });
    setCommentText(""); setCommenting(false); setLoading(false);
    onUpdate?.();
  };

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0, 0, 1] } } }}
      className="mb-4 card-base overflow-hidden relative"
    >
      {/* Accent left edge — "draft card" feel */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)', opacity: 0.85 }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)' }}>
          {post.athlete_avatar
            ? <img src={post.athlete_avatar} alt="" className="w-full h-full object-cover" />
            : <span className="font-elite text-xs" style={{ color: 'var(--accent)' }}>{(post.athlete_name || "A")[0].toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-work font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{post.athlete_name || "Athlete"}</p>
          <p className="font-elite text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{timeAgo}</p>
        </div>
        {(post.type === "achievement" || post.type === "streak") && (
          <span className="stamp-achieved animate-stamp-in">{config.label}</span>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
      )}
      {post.metric_value && post.metric_value.includes("http") && (
        <VideoPlayer url={post.metric_value} />
      )}

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm font-work leading-relaxed" style={{ color: 'var(--text-primary)' }}>{post.content}</p>
        {post.metric_value && !post.metric_value.includes("http") && (
          <p className="stat-number text-lg mt-2" style={{ color: 'var(--accent)' }}>{post.metric_value}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-6 px-4 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button onClick={handleLike}
          className={`flex items-center gap-1.5 transition-all duration-150 ${liked ? "scale-110" : ""}`}
          style={{ color: liked ? 'var(--accent)' : 'var(--text-tertiary)' }}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span className="font-elite text-xs tabular-nums">{post.likes || 0}</span>
        </button>
        <button onClick={() => setCommenting(!commenting)}
          className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
          <MessageCircle size={16} />
          <span className="font-elite text-xs tabular-nums">{(post.comments || []).length}</span>
        </button>
      </div>

      {/* Comments */}
      {(post.comments || []).length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          {post.comments.slice(-2).map((c, i) => (
            <p key={i} className="text-xs font-work" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.author_name} </span>
              {c.text}
            </p>
          ))}
        </div>
      )}

      {commenting && (
        <div className="px-4 pb-4 flex gap-2">
          <input
            className="input-base flex-1"
            style={{ minHeight: 40, fontSize: 'var(--text-sm)' }}
            placeholder="Add a comment…"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleComment()}
            autoFocus
          />
          <button onClick={handleComment} disabled={loading} className="btn-stamp">
            Post
          </button>
        </div>
      )}
    </motion.div>
  );
}