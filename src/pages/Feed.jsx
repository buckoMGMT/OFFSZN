import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Image, Video, Users, Globe } from "lucide-react";
import PostCard from "@/components/feed/PostCard";
import StreakBadge from "@/components/ui/StreakBadge";
import ClanFeed from "@/components/feed/ClanFeed";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [postVideoUrl, setPostVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [feedFilter, setFeedFilter] = useState("all"); // "all" | "friends" | "clan"

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
      metric_value: postVideoUrl || undefined,
      likes: 0,
      liked_by: [],
      comments: [],
    });
    setNewPost("");
    setPostImageUrl("");
    setPostVideoUrl("");
    setShowCompose(false);
    setPosting(false);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 pt-12 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-display text-primary tracking-widest">THE PLAYBOOK</h1>
          {athlete?.current_streak_days > 0 && (
            <StreakBadge days={athlete.current_streak_days} />
          )}
        </div>
        {/* Feed Filter Tabs */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1">
          <button
            onClick={() => setFeedFilter("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              feedFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Globe size={12} /> All
          </button>
          <button
            onClick={() => setFeedFilter("friends")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              feedFilter === "friends" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Users size={12} /> Friends
          </button>
          <button
            onClick={() => setFeedFilter("clan")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              feedFilter === "clan" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            🛡️ Team
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Clan Feed */}
        {feedFilter === "clan" && (
          <ClanFeed athlete={athlete} />
        )}

        {/* Compose */}
        {feedFilter !== "clan" && athlete && (
          <div className="border border-border rounded-xl p-3 mb-4 bg-card">
            {showCompose ? (
              <div className="space-y-3">
                <textarea
                  className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20"
                  placeholder="Share your progress..."
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors">
                    <Image size={13} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{uploading ? "Uploading…" : postImageUrl ? "✓ Photo" : "Photo"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary rounded-lg flex-1">
                    <Video size={13} className="text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="YouTube link"
                      className="bg-transparent text-xs text-foreground outline-none w-full"
                      value={postVideoUrl}
                      onChange={e => setPostVideoUrl(e.target.value)}
                    />
                  </div>
                </div>
                {postImageUrl && (
                  <img src={postImageUrl} alt="preview" className="w-full rounded-lg object-cover max-h-40" />
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setShowCompose(false); setPostImageUrl(""); setPostVideoUrl(""); }}
                    className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">
                    Cancel
                  </button>
                  <button onClick={submitPost} disabled={posting || !newPost.trim()}
                    className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCompose(true)} className="w-full flex items-center gap-3 text-left">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {athlete.avatar_url ? (
                    <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary">
                      {(athlete.display_name || "A")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-muted-foreground flex-1">What's your win today?</span>
                <Plus size={16} className="text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        {feedFilter !== "clan" && !loading && feedFilter === "friends" && (athlete?.friends || []).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center mb-4">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-base font-semibold text-foreground mb-1">No Friends Yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Join a clan and follow athletes to see their posts here.</p>
          </div>
        )}
        {feedFilter !== "clan" && loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="gradient-card border border-border rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-secondary" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-secondary rounded w-1/3" />
                    <div className="h-2 bg-secondary rounded w-1/5" />
                  </div>
                </div>
                <div className="h-4 bg-secondary rounded mb-2" />
                <div className="h-4 bg-secondary rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : feedFilter !== "clan" && posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-barlow font-bold text-foreground uppercase mb-2">The Feed Awaits</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Join a clan and start tracking your progress. Your wins will show up here.
            </p>
          </div>
        ) : feedFilter !== "clan" ? (
          <div>
            {posts
              .filter(post => {
                if (feedFilter === "friends") {
                  const friends = athlete?.friends || [];
                  return friends.includes(post.athlete_id) || post.athlete_id === athlete?.id;
                }
                return true;
              })
              .map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentAthleteId={athlete?.id}
                  onUpdate={load}
                />
              ))
            }
          </div>
        ) : null}
      </div>
    </div>
  );
}