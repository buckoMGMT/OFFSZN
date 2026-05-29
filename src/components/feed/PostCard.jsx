import { useState } from "react";
import { Heart, MessageCircle, Flame, Trophy, Dumbbell, Moon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import VideoPlayer from "@/components/feed/VideoPlayer";

const typeConfig = {
  achievement: { icon: Trophy, color: "text-primary", bg: "bg-primary/15" },
  macro_log: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/15" },
  workout_complete: { icon: Dumbbell, color: "text-green-400", bg: "bg-green-500/15" },
  streak: { icon: Flame, color: "text-primary", bg: "bg-primary/15" },
  clan_challenge: { icon: Trophy, color: "text-purple-400", bg: "bg-purple-500/15" },
  weight_milestone: { icon: Trophy, color: "text-blue-400", bg: "bg-blue-500/15" },
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
    const newLikedBy = liked
      ? likedBy.filter(id => id !== currentAthleteId)
      : [...likedBy, currentAthleteId];
    await base44.entities.SocialPost.update(post.id, {
      likes: newLikedBy.length,
      liked_by: newLikedBy,
    });
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
    <div className="border-b border-border py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
          {post.athlete_avatar ? (
            <img src={post.athlete_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-primary">
              {(post.athlete_name || "A")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{post.athlete_name || "Athlete"}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <Icon size={14} className={config.color} />
      </div>

      {/* Content */}
      <p className="text-sm text-foreground leading-relaxed mb-2">{post.content}</p>
      {post.metric_value && !post.metric_value.includes("http") && (
        <span className="text-primary text-sm font-semibold">{post.metric_value}</span>
      )}
      {post.metric_value && post.metric_value.includes("http") && (
        <div className="mb-2"><VideoPlayer url={post.metric_value} /></div>
      )}
      {post.image_url && (
        <img src={post.image_url} alt="" className="w-full rounded-lg object-cover max-h-60 mb-2" />
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 mt-2">
        <button onClick={handleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? "text-red-400" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span className="text-xs">{post.likes || 0}</span>
        </button>
        <button onClick={() => setCommenting(!commenting)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle size={16} />
          <span className="text-xs">{(post.comments || []).length}</span>
        </button>
      </div>

      {/* Comments */}
      {(post.comments || []).length > 0 && (
        <div className="mt-2 space-y-1">
          {post.comments.slice(-2).map((c, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{c.author_name} </span>
              {c.text}
            </p>
          ))}
        </div>
      )}

      {commenting && (
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Add a comment…"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleComment()}
            autoFocus
          />
          <button onClick={handleComment} disabled={loading}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold">
            Post
          </button>
        </div>
      )}
    </div>
  );
}