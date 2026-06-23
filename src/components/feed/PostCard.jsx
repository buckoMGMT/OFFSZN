import { useState } from "react";
import { Heart, MessageCircle, Flame, Trophy, Dumbbell, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import VideoPlayer from "@/components/feed/VideoPlayer";

const typeConfig = {
  achievement: { icon: Trophy, color: "text-primary", bg: "bg-primary/15", label: "Achievement" },
  macro_log: { icon: Flame, color: "text-accent", bg: "bg-accent/15", label: "Nutrition" },
  workout_complete: { icon: Dumbbell, color: "text-green-400", bg: "bg-green-500/15", label: "Workout" },
  streak: { icon: Zap, color: "text-primary", bg: "bg-primary/15", label: "Streak" },
  clan_challenge: { icon: Trophy, color: "text-purple-400", bg: "bg-purple-500/15", label: "Challenge" },
  weight_milestone: { icon: Trophy, color: "text-blue-400", bg: "bg-blue-500/15", label: "Milestone" },
};

export default function PostCard({ post, currentAthleteId, onUpdate }) {
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [justLiked, setJustLiked] = useState(false);

  const config = typeConfig[post.type] || typeConfig.achievement;
  const Icon = config.icon;
  const liked = (post.liked_by || []).includes(currentAthleteId);
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : "just now";

  const handleLike = async () => {
    const likedBy = post.liked_by || [];
    const newLikedBy = liked
      ? likedBy.filter(id => id !== currentAthleteId)
      : [...likedBy, currentAthleteId];
    if (!liked) setJustLiked(true);
    await base44.entities.SocialPost.update(post.id, {
      likes: newLikedBy.length,
      liked_by: newLikedBy,
    });
    setTimeout(() => setJustLiked(false), 600);
    onUpdate?.();
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    setLoading(true);
    const comments = post.comments || [];
    await base44.entities.SocialPost.update(post.id, {
      comments: [...comments, {
        author_id: currentAthleteId,
        author_name: "You",
        text: commentText.trim(),
        created_at: new Date().toISOString(),
      }],
    });
    setCommentText("");
    setCommenting(false);
    setLoading(false);
    onUpdate?.();
  };

  return (
    <div className="bg-card border border-border rounded-2xl mb-3 overflow-hidden elevation-1">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/60">
          {post.athlete_avatar ? (
            <img src={post.athlete_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-primary font-barlow">
              {(post.athlete_name || "A")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{post.athlete_name || "Athlete"}</p>
            {/* Team chip */}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-barlow font-bold uppercase ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">{timeAgo}</p>
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
          <Icon size={13} className={config.color} />
        </div>
      </div>

      {/* Full-bleed image */}
      {post.image_url && (
        <img src={post.image_url} alt="" className="w-full object-cover max-h-72" />
      )}
      {post.metric_value && post.metric_value.includes("http") && (
        <div><VideoPlayer url={post.metric_value} /></div>
      )}

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
        {post.metric_value && !post.metric_value.includes("http") && (
          <p className="text-primary text-sm font-mono font-bold mt-1 tabular-nums">{post.metric_value}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-5 px-4 pb-3 border-t border-border/50 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-all duration-200 ${
            liked ? "text-red-400 scale-110" : "text-muted-foreground"
          } ${justLiked ? "animate-count-up" : ""}`}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span className="text-xs font-mono tabular-nums">{post.likes || 0}</span>
        </button>
        <button
          onClick={() => setCommenting(!commenting)}
          className="flex items-center gap-1.5 text-muted-foreground transition-colors"
        >
          <MessageCircle size={16} />
          <span className="text-xs font-mono tabular-nums">{(post.comments || []).length}</span>
        </button>
      </div>

      {/* Comments */}
      {(post.comments || []).length > 0 && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border/40 pt-2">
          {post.comments.slice(-2).map((c, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-semibold">{c.author_name} </span>
              {c.text}
            </p>
          ))}
        </div>
      )}

      {commenting && (
        <div className="px-4 pb-4 flex gap-2">
          <input
            className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
            placeholder="Add a comment…"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleComment()}
            autoFocus
          />
          <button
            onClick={handleComment}
            disabled={loading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-barlow font-bold uppercase disabled:opacity-40"
          >
            Post
          </button>
        </div>
      )}
    </div>
  );
}