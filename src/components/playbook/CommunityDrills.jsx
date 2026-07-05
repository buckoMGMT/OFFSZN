import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Play, Eye, ThumbsUp, ChevronUp, BadgeCheck, CheckCircle2 } from "lucide-react";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";
import PricePill from "@/components/monetization/PricePill";
import CoachPurchaseSheet from "@/components/monetization/CoachPurchaseSheet";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";

const CATEGORY_LABELS = { workout: "Workout", tutorial: "Tutorial", form_check: "Form Check", progress: "Progress", challenge: "Challenge" };

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

// Community + coach marketplace drills (approved UGC, Lane 3 coach-priced items)
export default function CommunityDrills() {
  const [videos, setVideos] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const [buying, setBuying] = useState(null);
  const [purchasedIds, setPurchasedIds] = useState([]); // demo purchases, session-local
  const [profileCoach, setProfileCoach] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.UserVideoSubmission.filter({ status: "approved" }, "-views", 50),
      base44.entities.Athlete.list("-created_date", 100),
    ]).then(([vids, athletes]) => {
      setVideos(vids);
      setAuthors(Object.fromEntries(athletes.map(a => [a.id, a])));
      setLoading(false);
    });
  }, []);

  const isPaid = (v) => v.price_usd > 0 && !purchasedIds.includes(v.id);

  const handleRowClick = (v) => {
    if (isPaid(v)) {
      setBuying(v);
    } else {
      setPlaying(playing === v.id ? null : v.id);
    }
  };

  const handleBuy = () => {
    // Demo checkout — real payments hook in here at launch
    setPurchasedIds(prev => [...prev, buying.id]);
    setPlaying(buying.id);
    setBuying(null);
  };

  if (loading) return (
    <div className="space-y-3">
      {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 88 }} />)}
    </div>
  );

  if (videos.length === 0) return (
    <p className="font-work text-sm text-center py-16" style={{ color: 'var(--text-secondary)' }}>
      No community drills yet — be the first to submit one from your profile.
    </p>
  );

  const buyingCoach = buying ? authors[buying.athlete_id] : null;

  return (
    <div className="space-y-3">
      <p className="eyebrow">From the Community & Verified Coaches</p>
      {videos.map(v => {
        const author = authors[v.athlete_id];
        const isOpen = playing === v.id;
        const priced = v.price_usd > 0;
        const owned = purchasedIds.includes(v.id);
        return (
          <div key={v.id} className="card-base overflow-hidden">
            <button onClick={() => handleRowClick(v)} className="w-full p-3 flex items-center gap-3 text-left">
              <div className="w-11 h-11 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--accent)' }} /> : <Play size={16} fill="currentColor" style={{ color: 'var(--accent)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {author?.avatar_url && <img src={author.avatar_url} alt="" className="w-4 h-4 rounded-full object-cover" />}
                  <span
                    role={author?.is_coach_verified ? "button" : undefined}
                    onClick={author?.is_coach_verified ? (e) => { e.stopPropagation(); setProfileCoach(author); } : undefined}
                    className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-wide truncate"
                    style={{ color: author?.is_coach_verified ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                    {author?.display_name || "Athlete"}
                    {author?.is_coach_verified && <BadgeCheck size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    <span style={{ color: 'var(--text-tertiary)' }}>· {CATEGORY_LABELS[v.category] || v.category}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {priced && !owned && <PricePill price={`$${v.price_usd.toFixed(2)}`} />}
                  {owned && (
                    <span className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--positive)' }}>
                      <CheckCircle2 size={10} /> In your library
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="flex items-center gap-1 tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Eye size={10} /> {fmt(v.views || 0)}
                </span>
                <span className="flex items-center gap-1 tabular-nums text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <ThumbsUp size={10} /> {fmt(v.likes || 0)}
                </span>
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                {v.description && <p className="font-work text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{v.description}</p>}
                <ProtectedVideoPlayer url={v.video_url} />
              </div>
            )}
          </div>
        );
      })}

      <CoachPurchaseSheet
        open={!!buying}
        onClose={() => setBuying(null)}
        item={buying ? { title: buying.title, price: `$${buying.price_usd?.toFixed(2)}`, coachName: buyingCoach?.display_name || "Coach" } : null}
        onBuy={handleBuy}
      />

      <CoachProfileSheet
        open={!!profileCoach}
        onClose={() => setProfileCoach(null)}
        coach={profileCoach}
        videos={profileCoach ? videos.filter(v => v.athlete_id === profileCoach.id) : []}
        onSelectVideo={(v) => { setProfileCoach(null); handleRowClick(v); }}
      />
    </div>
  );
}