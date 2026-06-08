import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Shield } from "lucide-react";
import PostCard from "@/components/feed/PostCard";

export default function ClanFeed({ athlete }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clan, setClan] = useState(null);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const load = useCallback(async () => {
    if (!athlete?.clan_id) { setLoading(false); return; }
    const [clanList, allPosts] = await Promise.all([
      base44.entities.Clan.filter({ id: athlete.clan_id }),
      base44.entities.SocialPost.filter({ clan_id: athlete.clan_id }, "-created_date", 30),
    ]);
    setClan(clanList[0] || null);
    setPosts(allPosts);
    setLoading(false);
  }, [athlete]);

  useEffect(() => { load(); }, [load]);

  const submitPost = async () => {
    if (!newPost.trim() || !athlete) return;
    setPosting(true);
    await base44.entities.SocialPost.create({
      athlete_id: athlete.id,
      athlete_name: athlete.display_name,
      athlete_avatar: athlete.avatar_url,
      type: "achievement",
      content: newPost.trim(),
      clan_id: athlete.clan_id,
      likes: 0,
      liked_by: [],
      comments: [],
    });
    setNewPost("");
    setShowCompose(false);
    setPosting(false);
    load();
  };

  if (!athlete?.clan_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield size={48} className="text-muted-foreground mb-4 opacity-40" />
        <h3 className="text-lg font-barlow font-bold text-foreground uppercase mb-2">No Team Yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">Join a team from the Teams tab to see and post in your clan feed.</p>
      </div>
    );
  }

  return (
    <div>
      {clan && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <Shield size={13} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">{clan.name}</span>
          <span className="text-xs text-muted-foreground">· {(clan.member_ids || []).length} members</span>
        </div>
      )}

      {/* Compose */}
      <div className="border border-border rounded-xl p-3 mb-4 bg-card">
        {showCompose ? (
          <div className="space-y-3">
            <textarea
              className="w-full bg-secondary rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20"
              placeholder={`Post to ${clan?.name || "your team"}...`}
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCompose(false)}
                className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Cancel</button>
              <button onClick={submitPost} disabled={posting || !newPost.trim()}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCompose(true)} className="w-full flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
              {athlete?.avatar_url ? (
                <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-primary">{(athlete?.display_name || "A")[0].toUpperCase()}</span>
              )}
            </div>
            <span className="text-sm text-muted-foreground flex-1">Post to your team...</span>
            <Plus size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="gradient-card border border-border rounded-2xl p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-secondary" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-secondary rounded w-1/3" />
                  <div className="h-2 bg-secondary rounded w-1/5" />
                </div>
              </div>
              <div className="h-4 bg-secondary rounded mb-2" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No team posts yet. Be the first to post!</p>
        </div>
      ) : (
        posts.map(post => (
          <PostCard key={post.id} post={post} currentAthleteId={athlete?.id} onUpdate={load} />
        ))
      )}
    </div>
  );
}