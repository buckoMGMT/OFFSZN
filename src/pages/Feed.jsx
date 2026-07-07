import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Video, Users, Globe } from "lucide-react";
import PostCard from "@/components/feed/PostCard";
import ClanFeed from "@/components/feed/ClanFeed";
import PageLabel from "@/components/ui/PageLabel";
import PlayDiagram from "@/components/ui/PlayDiagram";
import StampButton from "@/components/ui/StampButton";
import GameDayHero from "@/components/feed/GameDayHero";
import { StaggerList } from "@/lib/motion.jsx";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedFilter, setFeedFilter] = useState("all");

  const load = useCallback(async () => {
    const [athleteList, postList] = await Promise.all([
      base44.entities.Athlete.list("-created_date", 1),
      base44.entities.SocialPost.list("-created_date", 30),
    ]);
    setAthlete(athleteList[0] || null);
    setPosts(postList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPostImageUrl(file_url);
    setUploading(false);
  };

  const submitPost = async () => {
    if (!newPost.trim() || !athlete) return;
    setPosting(true);
    await base44.entities.SocialPost.create({
      athlete_id: athlete.id,
      athlete_name: athlete.display_name,
      athlete_avatar: athlete.avatar_url,
      type: "achievement",
      content: newPost.trim(),
      image_url: postImageUrl || undefined,
      likes: 0,
      liked_by: [],
      comments: [],
    });
    setNewPost(""); setPostImageUrl(""); setShowCompose(false); setPosting(false);
    load();
  };

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 pt-12 pb-3 border-b" style={{ background: 'color-mix(in srgb, var(--surface-0) 82%, transparent)', borderColor: 'var(--border-strong)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}>
        {/* Accent top stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)', opacity: 0.9 }} />
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>The Field</h1>
          <PageLabel number={1} />
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--accent)' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent)' }} />
          </span>
          <p className="eyebrow" style={{ color: 'var(--accent)' }}>Live — Game Feed</p>
        </div>

        {/* Filter tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--theme-border)' }}>
          {[
            { id: "all", label: "All" },
            { id: "friends", label: "Friends" },
            { id: "clan", label: "Team" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFeedFilter(tab.id)}
              className="flex-1 py-2 font-elite text-xs uppercase tracking-widest transition-all"
              style={{
                color: feedFilter === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: feedFilter === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Game-day hero — the screenshot moment */}
        {feedFilter !== "clan" && <GameDayHero athlete={athlete} />}
        {/* Live-from-the-field rule */}
        {feedFilter !== "clan" && (
          <div className="live-rule mb-4">Live from the Field</div>
        )}
        {/* Clan feed */}
        {feedFilter === "clan" && <ClanFeed athlete={athlete} />}

        {/* Compose */}
        {feedFilter !== "clan" && athlete && (
          <div className="mb-4 card-base p-3">
            {showCompose ? (
              <div className="space-y-3">
                <textarea
                  className="input-base resize-none"
                  style={{ height: 80, padding: '12px 16px', minHeight: 'auto', fontSize: 'var(--text-sm)' }}
                  placeholder="What's your win today?"
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded cursor-pointer text-xs font-elite" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
                    <Image size={13} />
                    {uploading ? "Uploading…" : postImageUrl ? "✓ Photo" : "Photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                </div>
                {postImageUrl && <img src={postImageUrl} alt="preview" className="w-full rounded object-cover max-h-40" />}
                <div className="flex gap-2">
                  <button onClick={() => { setShowCompose(false); setPostImageUrl(""); }}
                    className="flex-1 py-2 rounded font-elite text-xs uppercase" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
                    Cancel
                  </button>
                  <StampButton onClick={submitPost} disabled={posting || !newPost.trim()} className="flex-1">
                    {posting ? "Posting…" : "Post It"}
                  </StampButton>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCompose(true)} className="w-full flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: 'var(--surface-3)', border: (athlete.current_streak_days || 0) > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border-subtle)' }}>
                  {athlete.avatar_url
                    ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs font-elite" style={{ color: 'var(--accent)' }}>{(athlete.display_name || "A")[0].toUpperCase()}</span>
                  }
                </div>
                <span className="text-sm font-work flex-1" style={{ color: 'var(--theme-ink-soft)' }}>Log a win…</span>
                <Plus size={15} style={{ color: 'var(--accent)' }} />
              </button>
            )}
          </div>
        )}

        {/* Loading state — play diagram instead of spinner */}
        {feedFilter !== "clan" && loading && (
          /* §5: Skeleton loaders replace spinners — content streams in */
          <div className="space-y-4 pt-2">
            {[1,2,3].map(i => (
              <div key={i} className="card-base p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--r-full)', flexShrink: 0 }} />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton" style={{ width: '55%', height: 13 }} />
                    <div className="skeleton" style={{ width: '35%', height: 10 }} />
                  </div>
                </div>
                <div className="skeleton" style={{ width: '100%', height: 12 }} />
                <div className="skeleton" style={{ width: '75%', height: 12 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {feedFilter !== "clan" && !loading && posts.length === 0 && (
          /* §5 EmptyState + §7 Hick's: one clear action */
          <div className="flex flex-col items-center justify-center py-16 text-center px-5">
            <PlayDiagram size={130} />
            <p style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-xl)', color: 'var(--text-primary)', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>
              The Field's Empty.
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '32ch' }}>
              Log your first win. The board doesn't fill itself.
            </p>
          </div>
        )}

        {/* Posts */}
        {feedFilter !== "clan" && !loading && posts.length > 0 && (
          <StaggerList>
            {posts
              .filter(post => {
                if (feedFilter === "friends") {
                  return (athlete?.friends || []).includes(post.athlete_id) || post.athlete_id === athlete?.id;
                }
                return true;
              })
              .map(post => (
                <PostCard key={post.id} post={post} currentAthleteId={athlete?.id} onUpdate={load} />
              ))
            }
          </StaggerList>
        )}
      </div>
    </div>
  );
}