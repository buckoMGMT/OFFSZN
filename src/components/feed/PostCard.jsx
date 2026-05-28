import { useState } from "react";
import { Heart, MessageCircle, Flame, Trophy, Dumbbell, Moon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";

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
    <div className="gradient-card border border-border rounded-2xl overflow-hidden mb-3">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
          {post.athlete_avatar ? (
            <img src={post.athlete_avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-barlow font-bold text-primary">
              {(post.athlete_name || "A")[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{post.athlete_name || "Athlete"}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        <div className={`p-2 rounded-xl ${config.bg}`}>
          <Icon size={16} className={config.color} />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-sm text-foreground leading-relaxed">{post.content}</p>
        {post.metric_value && (
          <div className="mt-2 inline-block bg-secondary rounded-lg px-3 py-1">
            <span className="text-primary font-barlow font-bold text-sm">{post.metric_value}</span>
          </div>
        )}
      </div>

      {post.image_url && (
        <div className="px-4 pb-3">
          <img src={post.image_url} alt="" className="w-full rounded-xl object-cover max-h-64" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-border">
        <button onClick={handleLike} className={`flex items-center gap-1.5 transition-colors ${liked ? "text-red-400" : "text-muted-foreground hover:text-red-400"}`}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
          <span className="text-xs font-medium">{post.likes || 0}</span>
        </button>
        <button onClick={() => setCommenting(!commenting)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
          <MessageCircle size={18} />
          <span className="text-xs font-medium">{(post.comments || []).length}</span>
        </button>
      </div>

      {/* Comments */}
      {(post.comments || []).length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {post.comments.slice(-2).map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="text-foreground font-semibold">{c.author_name}</span>{" "}
              {c.text}
            </div>
          ))}
        </div>
      )}

      {commenting && (
        <div className="px-4 pb-3 flex gap-2">
          <input
            className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Add a comment..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleComment()}
          />
          <button
            onClick={handleComment}
            disabled={loading}
            className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-barlow font-bold uppercase"
          >
            Post
          </button>
        </div>
      )}
    </div>
  );
}