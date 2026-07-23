import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Search } from "lucide-react";
import SearchSheet from "@/components/search/SearchSheet";
import AthleteProfileSheet from "@/components/profile/AthleteProfileSheet";
import PostCard from "@/components/feed/PostCard";
import ClanFeed from "@/components/feed/ClanFeed";
import PageLabel from "@/components/ui/PageLabel";
import EmptyState from "@/components/ui/EmptyState";
import StampButton from "@/components/ui/StampButton";
import SocialProofLine from "@/components/feed/SocialProofLine";
import PullToRefresh from "@/components/layout/PullToRefresh";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";
import { StaggerList } from "@/lib/motion.jsx";
import { track } from "@/lib/analytics";
import { validate, postSchema } from "@/lib/validators";
import useTabState from "@/lib/useTabState";
import { loadBlockedIds, getBlockedIds, onBlocksChanged } from "@/lib/blocks";

// Moderation decision (§3): media posts are held for review before public
// visibility; text-only posts publish immediately with moderator post-review.
const PRE_MODERATE_MEDIA = true;

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composeError, setComposeError] = useState(null);
  const [feedFilter, setFeedFilter] = useTabState("feed.filter", "all");
  const [showSearch, setShowSearch] = useState(false);
  const [profileAthlete, setProfileAthlete] = useState(null);
  const [postType, setPostType] = useState("achievement");
  const [showPaywall, setShowPaywall] = useState(false);
  const [blockedIds, setBlockedIds] = useState(() => getBlockedIds());

  // Blocked-user filtering — load once, refilter live after a block.
  useEffect(() => {
    loadBlockedIds().then(setBlockedIds);
    return onBlocksChanged(setBlockedIds);
  }, []);

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
    if (!athlete) return;
    // §5 zod: ≤2000 chars, at least text or media, trimmed + control chars stripped
    const r = validate(postSchema, { content: newPost, image_url: postImageUrl || undefined });
    if (r.error) { setComposeError(r.error); return; }
    setComposeError(null);
    setPosting(true);
    await base44.entities.SocialPost.create({
      athlete_id: athlete.id,
      athlete_name: athlete.display_name,
      athlete_avatar: athlete.avatar_url,
      type: postType,
      content: r.value.content,
      image_url: postImageUrl || undefined,
      likes: 0,
      liked_by: [],
      comments: [],
      status: postImageUrl && PRE_MODERATE_MEDIA ? "pending" : "approved",
    });
    track.postCreated({ type: postType });
    setNewPost(""); setPostImageUrl(""); setPostType("achievement"); setShowCompose(false); setPosting(false);
    load();
  };

  // Tap a post author (or search result) → their public profile
  const openProfile = async (athleteId) => {
    if (!athleteId) return;
    if (athleteId === athlete?.id) { setProfileAthlete(athlete); return; }
    const a = await base44.entities.Athlete.get(athleteId).catch(() => null);
    if (a) setProfileAthlete(a);
  };

  const visiblePosts = posts.filter(post => {
    // Pending/rejected posts are visible only to their author — never a scary error.
    const mine = post.athlete_id === athlete?.id;
    if (blockedIds.has(post.athlete_id)) return false;
    if ((post.status || "approved") !== "approved" && !mine) return false;
    if (feedFilter === "friends") {
      return (athlete?.friends || []).includes(post.athlete_id) || mine;
    }
    return true;
  });

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky z-40 px-5 pt-3 pb-3 border-b" style={{ top: 'var(--topbar-h)', background: 'color-mix(in srgb, var(--surface-0) 82%, transparent)', borderColor: 'var(--border-strong)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}>
        {/* Accent top stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)', opacity: 0.9 }} />
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>The Field</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSearch(true)} aria-label="Search athletes" style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none' }}>
              <Search size={18} />
            </button>
            <PageLabel number={1} />
          </div>
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

      <PullToRefresh onRefresh={load}>
      <div className="px-5 py-4">
        {/* Real social proof — hidden until the count is non-trivial */}
        {feedFilter !== "clan" && <SocialProofLine />}
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
                  maxLength={2000}
                  value={newPost}
                  onChange={e => { setNewPost(e.target.value); setComposeError(null); }}
                  autoFocus
                />
                {/* Post type — pick the heading: PR / Fuel / Win */}
                <div className="flex gap-1.5">
                  {[
                    { id: "achievement", label: "New PR" },
                    { id: "macro_log", label: "Fuel" },
                    { id: "workout_complete", label: "Win" },
                  ].map(t => (
                    <button key={t.id} onClick={() => setPostType(t.id)}
                      className="px-3 py-1.5 rounded font-elite text-[10px] uppercase tracking-widest"
                      style={{
                        background: postType === t.id ? 'var(--accent-subtle)' : 'var(--surface-2)',
                        border: postType === t.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        color: postType === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {athlete.subscription_tier === "premium" ? (
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded cursor-pointer text-xs font-elite" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
                      <Image size={13} />
                      {uploading ? "Uploading…" : postImageUrl ? "✓ Photo" : "Photo"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  ) : (
                    /* Walk-On tier: photo posting is an ALL-SZN Pass feature — tap opens the paywall, never a dead tap */
                    <button onClick={() => setShowPaywall(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded text-xs font-elite"
                      style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)', color: 'var(--text-tertiary)' }}>
                      <Image size={13} /> Photo — All-SZN
                    </button>
                  )}
                </div>
                {postImageUrl && <img src={postImageUrl} alt="preview" className="w-full rounded object-cover max-h-40" />}
                {composeError && <p className="text-xs" style={{ color: 'var(--negative)' }}>{composeError}</p>}
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

        {/* Empty — §5 EmptyState + §7 Hick's: one clear action */}
        {feedFilter !== "clan" && !loading && posts.length === 0 && (
          <EmptyState title="The Field's Empty." body="Log your first win. The board doesn't fill itself." />
        )}

        {/* Friends tab, nobody followed yet — clear path, not a blank wall */}
        {feedFilter === "friends" && !loading && posts.length > 0 && visiblePosts.length === 0 && (
          <EmptyState title="No Friends Yet." body="Follow athletes and their wins land here."
            action="Find Athletes" onAction={() => setShowSearch(true)} />
        )}

        {/* Posts */}
        {feedFilter !== "clan" && !loading && visiblePosts.length > 0 && (
          <StaggerList>
            {visiblePosts
              .map(post => (
                <div key={post.id} className="relative">
                  {(post.status || "approved") === "pending" && post.athlete_id === athlete?.id && (
                    <span className="absolute top-2 right-2 z-10 font-elite text-[8px] uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                      In review
                    </span>
                  )}
                  <PostCard post={post} currentAthleteId={athlete?.id} currentAthleteName={athlete?.display_name} onUpdate={load} onOpenProfile={openProfile} />
                </div>
              ))
            }
          </StaggerList>
        )}
      </div>
      </PullToRefresh>

      <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
      <SearchSheet open={showSearch} onClose={() => setShowSearch(false)} onSelect={a => setProfileAthlete(a)} />
      <AthleteProfileSheet
        open={!!profileAthlete}
        onClose={() => setProfileAthlete(null)}
        athlete={profileAthlete}
        me={athlete}
        onFollowChange={friends => setAthlete(prev => (prev ? { ...prev, friends } : prev))}
      />
    </div>
  );
}