import { useState } from "react";
import { Heart, MessageCircle, Trophy, Flame, Dumbbell, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDistanceToNow } from "date-fns";
import VideoPlayer from "@/components/feed/VideoPlayer";
import { motion, useReducedMotion } from "framer-motion";

// Typed post cards — every post no longer has the same visual weight.
// PR = stat hero. Fuel = macro chip row. Win = accent quote hairline.
const typeConfig = {
  achievement:      { icon: Trophy,   label: "Personal Record", chip: "PR" },
  macro_log:        { icon: Flame,    label: "Fuel",             chip: "FUEL" },
  workout_complete: { icon: Dumbbell, label: "Win",             chip: "WIN" },
  streak:           { icon: Zap,      label: "Win",             chip: "WIN" },
  clan_challenge:   { icon: Trophy,   label: "Win",             chip: "WIN" },
  weight_milestone: { icon: Trophy,   label: "Win",             chip: "WIN" },
};

function MacroChips({ content }) {
  const chips = content.split(/[·,]/).map(s => s.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c, i) => (
        <span key={i}
          className="rounded font-elite text-[10px] uppercase tracking-wider tabular-nums"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '3px 8px' }}>
          {c}
        </span>
      ))}
    </div>
  );
}

export default function PostCard({ post, currentAthleteId, onUpdate }) {
  const [commenting, setCommenting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);

  const reduceMotion = useReducedMotion();
  const config = typeConfig[post.type] || typeConfig.achievement;
  const Icon = config.icon;
  const liked = (post.liked_by || []).includes(currentAthleteId);
  const likeCount = post.likes || 0;
  const commentCount = (post.comments || []).length;
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : "just now";

  const isPR = post.type === "achievement";
  const isFuel = post.type === "macro_log";
  const isWin = ["workout_complete", "streak", "clan_challenge", "weight_milestone"].includes(post.type);
  const hasVideo = post.metric_value && post.metric_value.includes("http");

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
      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0, 0, 1] } } }}
      className="mb-4 card-base overflow-hidden relative"
    >
      {/* Win cards: 2px accent left hairline — a highlighted quote from the field */}
      {isWin && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--accent)' }} />
      )}

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
        {/* PR chip — pulses once on first viewport entry */}
        {isPR && (
          <motion.span
            className="pr-chip"
            initial={{ scale: 1 }}
            whileInView={reduceMotion ? {} : { scale: [1, 1.08, 1], transition: { duration: 0.4, ease: [0.2, 0, 0, 1] } }}
            viewport={{ once: true, margin: "-10% 0px" }}
          >
            PR
          </motion.span>
        )}
        {isFuel && (
          <span className="eyebrow" style={{ color: 'var(--accent)' }}>Fuel</span>
        )}
        {isWin && (
          <span className="eyebrow">{config.label}</span>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" className="w-full object-cover" style={{ maxHeight: 320 }} />
      )}
      {hasVideo && <VideoPlayer url={post.metric_value} />}

      {/* PR card — the stat is the hero */}
      {isPR && (
        <div className="px-4 py-4">
          <p className="eyebrow mb-1">Personal Record</p>
          <p style={{ fontFamily: "'Archivo Black', sans-serif", fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-2xl)', color: 'var(--accent)', lineHeight: 1.1 }}>
            {post.metric_value && !hasVideo ? post.metric_value : "New PR"}
          </p>
          {post.content && (
            <p className="text-sm font-work leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>{post.content}</p>
          )}
        </div>
      )}

      {/* Fuel card — numbers promoted to chips */}
      {isFuel && (
        <div className="px-4 py-3">
          {post.metric_value && !hasVideo && (
            <p className="stat-number text-lg" style={{ color: 'var(--accent)' }}>{post.metric_value}</p>
          )}
          <MacroChips content={post.content} />
        </div>
      )}

      {/* Win card — highlighted quote */}
      {isWin && (
        <div className="px-4 py-3" style={{ paddingLeft: 16 }}>
          {post.metric_value && !hasVideo && (
            <p className="stat-number text-lg" style={{ color: 'var(--accent)' }}>{post.metric_value}</p>
          )}
          <p className="text-sm font-work leading-relaxed" style={{ color: 'var(--text-primary)' }}>{post.content}</p>
        </div>
      )}

      {/* Standard fallback (no type match) */}
      {!isPR && !isFuel && !isWin && (
        <div className="px-4 py-3">
          <p className="text-sm font-work leading-relaxed" style={{ color: 'var(--text-primary)' }}>{post.content}</p>
          {post.metric_value && !hasVideo && (
            <p className="stat-number text-lg mt-2" style={{ color: 'var(--accent)' }}>{post.metric_value}</p>
          )}
        </div>
      )}

      {/* Actions — hide zeros; icon fills accent when viewer engaged */}
      <div className="flex items-center gap-6 px-4 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button onClick={handleLike}
          className="flex items-center gap-1.5 transition-all duration-150"
          style={{ color: liked ? 'var(--accent)' : 'var(--text-tertiary)' }}>
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          {likeCount > 0 && <span className="font-elite text-xs tabular-nums">{likeCount}</span>}
        </button>
        <button onClick={() => setCommenting(!commenting)}
          className="flex items-center gap-1.5"
          style={{ color: commenting ? 'var(--accent)' : 'var(--text-tertiary)' }}>
          <MessageCircle size={16} fill={commenting ? "currentColor" : "none"} />
          {commentCount > 0 && <span className="font-elite text-xs tabular-nums">{commentCount}</span>}
        </button>
      </div>

      {/* Comments */}
      {commentCount > 0 && (
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