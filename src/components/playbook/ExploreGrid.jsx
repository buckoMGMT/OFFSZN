// Instagram-explore-style mixed grid: platform programs + coach/community videos.
// Video tiles lead to the creator's coach profile; priced items route through the purchase sheet.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Play, BadgeCheck, Clock } from "lucide-react";
import PassRibbon from "@/components/monetization/PassRibbon";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";
import CoachPurchaseSheet from "@/components/monetization/CoachPurchaseSheet";
import ExploreVideoSheet from "@/components/playbook/ExploreVideoSheet";
import useSubscriptions from "@/lib/useSubscriptions";
import isCoachDiscoverable from "@/lib/coachGate";

const SPORT_THUMBS = {
  football: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80",
  basketball: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80",
  baseball: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80",
  soccer: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80",
  track: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80",
  volleyball: "https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80",
  swimming: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80",
  wrestling: "https://images.unsplash.com/photo-1517438476312-10d79c077509?w=400&q=80",
};
const DEFAULT_THUMB = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80";

function fmt(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n || 0}`;
}

const VIDEO_SORTERS = {
  newest: (a, b) => new Date(b.created_date) - new Date(a.created_date),
  popular: (a, b) => (b.views || 0) - (a.views || 0),
  top_rated: (a, b) => (b.likes || 0) - (a.likes || 0),
  price_low: (a, b) => (a.price_usd || 0) - (b.price_usd || 0),
  price_high: (a, b) => (b.price_usd || 0) - (a.price_usd || 0),
};

// Paid coach videos become the big featured tiles; free videos and programs fill around them.
// When a non-featured sort is active, the strict sorted order is respected (no big-tile promotion).
function buildItems(programs, videos, featured = true) {
  if (!featured) {
    const out = [];
    const max = Math.max(programs.length, videos.length);
    for (let i = 0; i < max; i++) {
      if (videos[i]) out.push({ kind: "video", data: videos[i], key: `v-${videos[i].id}` });
      if (programs[i]) out.push({ kind: "program", data: programs[i], key: `p-${programs[i].id}` });
    }
    return out;
  }
  const paid = videos.filter(v => v.price_usd > 0);
  const free = videos.filter(v => !(v.price_usd > 0));
  const rest = [];
  const max = Math.max(programs.length, free.length);
  for (let i = 0; i < max; i++) {
    if (free[i]) rest.push({ kind: "video", data: free[i], key: `v-${free[i].id}` });
    if (programs[i]) rest.push({ kind: "program", data: programs[i], key: `p-${programs[i].id}` });
  }
  const out = [];
  let pi = 0;
  while (rest.length || pi < paid.length) {
    if (pi < paid.length) {
      out.push({ kind: "video", data: paid[pi], key: `v-${paid[pi].id}`, big: true });
      pi++;
    }
    out.push(...rest.splice(0, 6));
  }
  return out;
}

export default function ExploreGrid({ programs, sportFilter, isPremium, athlete, sortBy = "featured", priceFilter = "all", difficultyFilter = "all", onSelectProgram, onLockedProgram }) {
  const { subscribedIds, toggle } = useSubscriptions(athlete);
  const [videos, setVideos] = useState([]);
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [profileCoach, setProfileCoach] = useState(null);
  const [buying, setBuying] = useState(null);
  const [watching, setWatching] = useState(null);
  const [purchasedIds, setPurchasedIds] = useState([]); // demo purchases, session-local

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

  let filteredVideos = videos.filter(v =>
    // Coach gate: undiscoverable coaches (unverified / <3 drills / incomplete storefront) stay private
    (!authors[v.athlete_id] || isCoachDiscoverable(authors[v.athlete_id])) &&
    (sportFilter === "All" || (v.sport || "").toLowerCase() === sportFilter.toLowerCase()) &&
    (priceFilter === "all" || (priceFilter === "paid" ? v.price_usd > 0 : !(v.price_usd > 0))) &&
    (difficultyFilter === "all" || (v.difficulty || "").toLowerCase() === difficultyFilter)
  );
  if (VIDEO_SORTERS[sortBy]) filteredVideos = [...filteredVideos].sort(VIDEO_SORTERS[sortBy]);

  // Tap a video anywhere → open the creator's profile (their storefront)
  const openVideo = (v) => {
    const author = authors[v.athlete_id];
    if (author) setProfileCoach(author);
    else playOrBuy(v);
  };

  const playOrBuy = (v) => {
    if (v.price_usd > 0 && !purchasedIds.includes(v.id)) setBuying(v);
    else setWatching(v);
  };

  const handleBuy = () => {
    // Demo checkout — real payments hook in here at launch
    setPurchasedIds(prev => [...prev, buying.id]);
    setWatching(buying);
    setBuying(null);
  };

  if (loading) return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 9 }).map((_, i) => <div key={i} className="skeleton aspect-square" style={{ borderRadius: 2 }} />)}
    </div>
  );

  const items = buildItems(programs, filteredVideos, sortBy === "featured");
  const buyingCoach = buying ? authors[buying.athlete_id] : null;

  if (items.length === 0) return (
    <div className="text-center py-16 px-6">
      <p className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>Fresh Drops Incoming</p>
      <p className="font-work text-sm" style={{ color: 'var(--text-secondary)' }}>More drops as coaches join. Clear a filter to see what's live now.</p>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 -mx-4" style={{ gridAutoFlow: 'dense' }}>
        {items.map((item) => {
          const big = !!item.big;
          if (item.kind === "program") {
            const p = item.data;
            const locked = p.isPremium && !isPremium;
            return (
              <button key={item.key} onClick={() => locked ? onLockedProgram() : onSelectProgram(p)}
                className={`relative overflow-hidden text-left ${big ? "col-span-2 row-span-2" : "aspect-square"}`}>
                <img src={p.cover} alt={p.title} className="absolute inset-0 w-full h-full object-cover" style={{ filter: locked ? 'blur(6px) brightness(0.5)' : 'none' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,13,0.85) 0%, transparent 55%)' }} />
                {locked && <PassRibbon />}
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Program</p>
                  <p className={`font-work font-semibold leading-tight ${big ? "text-sm" : "text-[10px]"}`} style={{ color: '#fff' }}>
                    {locked ? "All-SZN Program" : p.title}
                  </p>
                  <span className="flex items-center gap-1 font-elite text-[8px] uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <Clock size={8} /> {p.duration}m
                  </span>
                </div>
              </button>
            );
          }
          const v = item.data;
          const author = authors[v.athlete_id];
          const owned = purchasedIds.includes(v.id);
          const priced = v.price_usd > 0 && !owned;
          const thumb = v.thumbnail_url || SPORT_THUMBS[v.sport] || DEFAULT_THUMB;
          if (big) {
            const handle = "@" + (author?.display_name || "coach").toLowerCase().replace(/[^a-z0-9]/g, "");
            return (
              <button key={item.key} onClick={() => openVideo(v)}
                className="relative col-span-2 row-span-2 overflow-hidden text-left flex flex-col"
                style={{ background: 'var(--surface-1)' }}>
                <div className="relative flex-1 min-h-0 w-full">
                  <img src={thumb} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,13,0.7) 0%, transparent 45%)' }} />
                  <Play size={16} fill="#fff" className="absolute top-2 right-2" style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
                  <p className="absolute bottom-1.5 left-2 right-2 font-work text-sm font-semibold leading-tight" style={{ color: '#fff' }}>{v.title}</p>
                </div>
                {/* Coach profile bar under the featured video */}
                <div className="flex items-center gap-2 w-full px-2 py-1.5 flex-shrink-0" style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border-subtle)' }}>
                  {author?.avatar_url && <img src={author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--accent)' }} />}
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-1 font-work text-[10px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {author?.display_name || "Coach"}
                      {author?.is_coach_verified && <BadgeCheck size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </span>
                    <span className="block font-elite text-[8px] uppercase tracking-wide truncate" style={{ color: 'var(--text-tertiary)' }}>{handle} · {fmt(v.views)} views</span>
                  </div>
                  {priced && (
                    <span className="tabular-nums text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                      ${v.price_usd.toFixed(2)}
                    </span>
                  )}
                </div>
              </button>
            );
          }
          return (
            <button key={item.key} onClick={() => openVideo(v)}
              className="relative overflow-hidden text-left aspect-square">
              <img src={thumb} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,13,0.88) 0%, transparent 55%)' }} />
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                <Play size={11} fill="#fff" style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
              </div>
              {priced && (
                <span className="absolute top-1.5 left-1.5 tabular-nums text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(10,11,13,0.75)', border: '1px solid var(--border-strong)', color: '#fff' }}>
                  ${v.price_usd.toFixed(2)}
                </span>
              )}
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <p className="font-work font-semibold leading-tight text-[10px]" style={{ color: '#fff' }}>{v.title}</p>
                <span className="flex items-center gap-1 font-elite text-[8px] uppercase tracking-wide mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {author?.display_name || "Athlete"}
                  {author?.is_coach_verified && <BadgeCheck size={9} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                  <span>· {fmt(v.views)} views</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <CoachProfileSheet
        open={!!profileCoach}
        onClose={() => setProfileCoach(null)}
        coach={profileCoach}
        videos={profileCoach ? videos.filter(v => v.athlete_id === profileCoach.id) : []}
        onSelectVideo={(v) => { setProfileCoach(null); playOrBuy(v); }}
        isSubscribed={profileCoach ? subscribedIds.includes(profileCoach.id) : false}
        onToggleSubscribe={toggle}
      />

      <CoachPurchaseSheet
        open={!!buying}
        onClose={() => setBuying(null)}
        item={buying ? { title: buying.title, price: `$${buying.price_usd?.toFixed(2)}`, coachName: buyingCoach?.display_name || "Coach" } : null}
        onBuy={handleBuy}
      />

      <ExploreVideoSheet
        open={!!watching}
        onClose={() => setWatching(null)}
        video={watching}
        author={watching ? authors[watching.athlete_id] : null}
      />
    </>
  );
}