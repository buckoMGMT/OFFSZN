import { useState } from "react";
import { Heart, MessageCircle, Trophy, Flame, Dumbbell, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import VideoPlayer from "@/components/feed/VideoPlayer";

const typeConfig = {
  achievement:     { icon: Trophy,   label: "PR",       stampColor: "#00C853" },
  macro_log:       { icon: Flame,    label: "Nutrition", stampColor: "#5E646B" },
  workout_complete:{ icon: Dumbbell, label: "Workout",  stampColor: "#5E646B" },
  streak:          { icon: Zap,      label: "SZN Streak", stampColor: "#00C853" },
  clan_challenge:  { icon: Trophy,   label: "Challenge",stampColor: "#00C853" },
  weight_milestone:{ icon: Trophy,   label: "Milestone",stampColor: "#00C853" },
};

// Slight random rotation for "clipped-in" feel — stable per post id
function clipRotation(id = "") {
  const n = id.charCodeAt(0) % 5;
  return [-1.5, 0.5, -0.5, 1, -1][n];
}

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
  const rot = clipRotation(post.id);

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
    <div
      className="mb-4 relative"
      style={{ transform: `rotate(${rot}deg)` }}
    >
      {/* Pin/clip detail */}
      <div className="absolute -top-1.5 left-6 w-4 h-3 rounded-sm z-10" style={{ background: '#9BA3AC', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />

      <div className="rounded overflow-hidden border" style={{ borderColor: '#9BA3AC', background: '#EDEEF0', boxShadow: '2px 3px 8px rgba(0,0,0,0.18)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b" style={{ borderColor: '#DCDEE1' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0" style={{ background: '#DCDEE1', border: '1px solid #9BA3AC' }}>
            {post.athlete_avatar
              ? <img src={post.athlete_avatar} alt="" className="w-full h-full object-cover" />
              : <span className="font-elite text-xs" style={{ color: '#00C853' }}>{(post.athlete_name || "A")[0].toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-work font-semibold truncate" style={{ color: '#15151A' }}>{post.athlete_name || "Athlete"}</p>
            <p className="font-elite text-[9px] uppercase tracking-wider" style={{ color: '#5A5D63' }}>{timeAgo}</p>
          </div>
          {/* Ink stamp badge for PR/achievement */}
          {(post.type === "achievement" || post.type === "streak") && (
            <span className="ink-stamp animate-stamp-in">{config.label}</span>
          )}
        </div>

        {/* Image — square-ish with slight overflow */}
        {post.image_url && (
          <img src={post.image_url} alt="" className="w-full object-cover" style={{ maxHeight: 260 }} />
        )}
        {post.metric_value && post.metric_value.includes("http") && (
          <VideoPlayer url={post.metric_value} />
        )}

        {/* Content */}
        <div className="px-4 py-3">
          <p className="text-sm font-work leading-relaxed" style={{ color: '#15151A' }}>{post.content}</p>
          {post.metric_value && !post.metric_value.includes("http") && (
            <p className="font-elite text-base mt-1" style={{ color: '#00C853' }}>{post.metric_value}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-5 px-4 pb-3 pt-2 border-t" style={{ borderColor: '#DCDEE1' }}>
          <button onClick={handleLike}
            className={`flex items-center gap-1.5 transition-all duration-150 ${liked ? "scale-110" : ""}`}
            style={{ color: liked ? '#00C853' : '#9BA3AC' }}>
            <Heart size={15} fill={liked ? "currentColor" : "none"} />
            <span className="font-elite text-xs">{post.likes || 0}</span>
          </button>
          <button onClick={() => setCommenting(!commenting)}
            className="flex items-center gap-1.5" style={{ color: '#9BA3AC' }}>
            <MessageCircle size={15} />
            <span className="font-elite text-xs">{(post.comments || []).length}</span>
          </button>
        </div>

        {/* Comments */}
        {(post.comments || []).length > 0 && (
          <div className="px-4 pb-3 space-y-1 border-t pt-2" style={{ borderColor: '#DCDEE1' }}>
            {post.comments.slice(-2).map((c, i) => (
              <p key={i} className="text-xs font-work" style={{ color: '#5A5D63' }}>
                <span className="font-semibold" style={{ color: '#15151A' }}>{c.author_name} </span>
                {c.text}
              </p>
            ))}
          </div>
        )}

        {commenting && (
          <div className="px-4 pb-4 flex gap-2">
            <input
              className="flex-1 rounded px-3 py-2 text-sm font-work outline-none"
              style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
              placeholder="Add a comment…"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleComment()}
              autoFocus
            />
            <button onClick={handleComment} disabled={loading}
              className="btn-stamp" style={{ transform: 'rotate(0deg)' }}>
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}