import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Video, Users, Globe } from "lucide-react";
import PostCard from "@/components/feed/PostCard";
import ClanFeed from "@/components/feed/ClanFeed";
import PageLabel from "@/components/ui/PageLabel";
import PlayDiagram from "@/components/ui/PlayDiagram";
import StampButton from "@/components/ui/StampButton";

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
    <div className="min-h-screen" style={{ background: 'var(--theme-bg)', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-3 border-b" style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: 'var(--theme-ink)' }}>The Field</h1>
          <PageLabel number={1} />
        </div>
        <p className="font-elite text-xs mb-3" style={{ color: 'var(--theme-ink-soft)' }}>GAME FEED — LIVE REPORTS</p>

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
                color: feedFilter === tab.id ? '#00C853' : '#5A5D63',
                borderBottom: feedFilter === tab.id ? '2px solid #00C853' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Clan feed */}
        {feedFilter === "clan" && <ClanFeed athlete={athlete} />}

        {/* Compose */}
        {feedFilter !== "clan" && athlete && (
          <div className="mb-4 border rounded p-3" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-surface)' }}>
            {showCompose ? (
              <div className="space-y-3">
                <textarea
                  className="w-full rounded px-3 py-2.5 text-sm outline-none resize-none h-20 font-work"
                  style={{ background: 'var(--theme-surface-alt)', color: 'var(--theme-ink)', border: '1px solid var(--theme-border)' }}
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
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: '#9BA3AC' }}>
                  {athlete.avatar_url
                    ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs font-elite text-white">{(athlete.display_name || "A")[0].toUpperCase()}</span>
                  }
                </div>
                <span className="text-sm font-work flex-1" style={{ color: 'var(--theme-ink-soft)' }}>Log a win…</span>
                <Plus size={15} style={{ color: '#00C853' }} />
              </button>
            )}
          </div>
        )}

        {/* Loading state — play diagram instead of spinner */}
        {feedFilter !== "clan" && loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <PlayDiagram size={160} />
            <p className="font-elite text-xs mt-4" style={{ color: 'var(--theme-ink-soft)' }}>Loading the field…</p>
          </div>
        )}

        {/* Empty */}
        {feedFilter !== "clan" && !loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PlayDiagram size={160} />
            <h3 className="font-anton text-xl uppercase mt-4 mb-1" style={{ color: 'var(--theme-ink)' }}>The Feed Awaits</h3>
            <p className="text-sm font-work max-w-xs" style={{ color: 'var(--theme-ink-soft)' }}>Join a team. Log your first win. Show up on the board.</p>
          </div>
        )}

        {/* Posts */}
        {feedFilter !== "clan" && !loading && posts.length > 0 && (
          <div>
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
          </div>
        )}
      </div>
    </div>
  );
}