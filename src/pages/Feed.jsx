import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Bell } from "lucide-react";
import PostCard from "@/components/feed/PostCard";
import GoldBadge from "@/components/ui/GoldBadge";
import StreakBadge from "@/components/ui/StreakBadge";

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

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

  const submitPost = async () => {
    if (!newPost.trim() || !athlete) return;
    setPosting(true);
    await base44.entities.SocialPost.create({
      athlete_id: athlete.id,
      athlete_name: athlete.display_name,
      athlete_avatar: athlete.avatar_url,
      type: "achievement",
      content: newPost.trim(),
      likes: 0,
      liked_by: [],
      comments: [],
    });
    setNewPost("");
    setShowCompose(false);
    setPosting(false);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display text-primary gold-text-glow tracking-widest">THE PLAYBOOK</h1>
            <p className="text-xs text-muted-foreground font-barlow uppercase tracking-widest">Proverbs 3:5-6</p>
          </div>
          <div className="flex items-center gap-3">
            {athlete?.current_streak_days > 0 && (
              <StreakBadge days={athlete.current_streak_days} />
            )}
            <button className="p-2 rounded-xl bg-secondary text-muted-foreground">
              <Bell size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Compose */}
        {athlete && (
          <div className="gradient-card border border-border rounded-2xl p-4 mb-4">
            {showCompose ? (
              <div className="space-y-3">
                <textarea
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-24"
                  placeholder="Share your progress, achievement, or motivate your squad..."
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCompose(false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-barlow font-bold uppercase">
                    Cancel
                  </button>
                  <button onClick={submitPost} disabled={posting || !newPost.trim()} className="flex-1 py-2.5 rounded-xl gradient-gold text-primary-foreground text-sm font-barlow font-bold uppercase disabled:opacity-50">
                    {posting ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCompose(true)} className="w-full flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-xs font-barlow font-bold text-primary">
                    {(athlete.display_name || "A")[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground flex-1">Share your progress...</span>
                <div className="p-2 rounded-xl bg-primary/15">
                  <Plus size={16} className="text-primary" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Feed */}
        {loading ? (
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
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-barlow font-bold text-foreground uppercase mb-2">The Feed Awaits</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Join a clan and start tracking your progress. Your wins will show up here.
            </p>
          </div>
        ) : (
          <div>
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentAthleteId={athlete?.id}
                onUpdate={load}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}