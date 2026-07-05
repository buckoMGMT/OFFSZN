// Instagram-explore-style mixed grid: platform programs + coach/community videos.
// Video tiles lead to the creator's coach profile; priced items route through the purchase sheet.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Play, BadgeCheck, Clock } from "lucide-react";
import PassRibbon from "@/components/monetization/PassRibbon";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";
import CoachPurchaseSheet from "@/components/monetization/CoachPurchaseSheet";
import ExploreVideoSheet from "@/components/playbook/ExploreVideoSheet";

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

function interleave(programs, videos) {
  const out = [];
  const max = Math.max(programs.length, videos.length);
  for (let i = 0; i < max; i++) {
    if (videos[i]) out.push({ kind: "video", data: videos[i], key: `v-${videos[i].id}` });
    if (programs[i]) out.push({ kind: "program", data: programs[i], key: `p-${programs[i].id}` });
  }
  return out;
}

export default function ExploreGrid({ programs, sportFilter, isPremium, onSelectProgram, onLockedProgram }) {
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

  const filteredVideos = sportFilter === "All"
    ? videos
    : videos.filter(v => (v.sport || "").toLowerCase() === sportFilter.toLowerCase());

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

  const items = interleave(programs, filteredVideos);
  const buyingCoach = buying ? authors[buying.athlete_id] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5 -mx-4" style={{ gridAutoFlow: 'dense' }}>
        {items.map((item, i) => {
          const big = i % 7 === 0;
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
          return (
            <button key={item.key} onClick={() => openVideo(v)}
              className={`relative overflow-hidden text-left ${big ? "col-span-2 row-span-2" : "aspect-square"}`}>
              <img src={SPORT_THUMBS[v.sport] || DEFAULT_THUMB} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,13,0.88) 0%, transparent 55%)' }} />
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                <Play size={big ? 14 : 11} fill="#fff" style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
              </div>
              {priced && (
                <span className="absolute top-1.5 left-1.5 tabular-nums text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(10,11,13,0.75)', border: '1px solid var(--border-strong)', color: '#fff' }}>
                  ${v.price_usd.toFixed(2)}
                </span>
              )}
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <p className={`font-work font-semibold leading-tight ${big ? "text-sm" : "text-[10px]"}`} style={{ color: '#fff' }}>{v.title}</p>
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