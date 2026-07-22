// Unified discovery bar: search drills, videos, and coach/user profiles + sort/filter sheet.
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Search, X, SlidersHorizontal, BadgeCheck, Play, Dumbbell } from "lucide-react";
import SortFilterSheet from "@/components/playbook/SortFilterSheet";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";
import CoachPurchaseSheet from "@/components/monetization/CoachPurchaseSheet";
import ExploreVideoSheet from "@/components/playbook/ExploreVideoSheet";
import CoachesForYou from "@/components/playbook/CoachesForYou";
import isCoachDiscoverable from "@/lib/coachGate";
import useSubscriptions from "@/lib/useSubscriptions";

export default function DiscoveryBar({ athlete, programs, onSelectProgram, sortBy, setSortBy, priceFilter, setPriceFilter, difficultyFilter, setDifficultyFilter }) {
  const { subscribedIds, toggle } = useSubscriptions(athlete);
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [athletes, setAthletes] = useState([]);
  const [videos, setVideos] = useState([]);
  const [profileCoach, setProfileCoach] = useState(null);
  const [buying, setBuying] = useState(null);
  const [watching, setWatching] = useState(null);
  const [purchasedIds, setPurchasedIds] = useState([]);
  const boxRef = useRef(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Athlete.list("-created_date", 100),
      base44.entities.UserVideoSubmission.filter({ status: "approved" }, "-views", 50),
    ]).then(([a, v]) => { setAthletes(a); setVideos(v); });
  }, []);

  const term = q.trim().toLowerCase();
  const searching = term.length >= 2;
  const matchedPrograms = searching ? programs.filter(p => `${p.title} ${p.sport} ${p.category}`.toLowerCase().includes(term)).slice(0, 3) : [];
  const matchedProfiles = searching ? athletes.filter(a => `${a.display_name} ${a.school || ""} ${a.sport || ""}`.toLowerCase().includes(term)).slice(0, 4) : [];
  const matchedVideos = searching ? videos.filter(v => `${v.title} ${v.sport || ""}`.toLowerCase().includes(term)).slice(0, 3) : [];
  const noResults = searching && !matchedPrograms.length && !matchedProfiles.length && !matchedVideos.length;

  const filtersActive = sortBy !== "featured" || priceFilter !== "all" || difficultyFilter !== "all";

  const playOrBuy = (v) => {
    if (v.price_usd > 0 && !purchasedIds.includes(v.id)) setBuying(v);
    else setWatching(v);
  };

  return (
    <div className="relative mb-4" ref={boxRef}>
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search drills, coaches, athletes…"
            className="w-full rounded-full pl-9 pr-8 py-2.5 text-sm font-work outline-none"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={13} style={{ color: 'var(--text-tertiary)' }} />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(true)} className="relative p-2.5 rounded-full flex-shrink-0"
          style={{ background: filtersActive ? 'var(--accent-subtle)' : 'var(--surface-1)', border: filtersActive ? '1px solid var(--accent)' : '1px solid var(--border-subtle)' }}>
          <SlidersHorizontal size={15} style={{ color: filtersActive ? 'var(--accent)' : 'var(--text-secondary)' }} />
          {filtersActive && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />}
        </button>
      </div>

      {/* Quick results dropdown */}
      {searching && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-lg overflow-hidden overlay-shadow"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {matchedProfiles.length > 0 && (
              <>
                <p className="eyebrow px-2 pt-1 pb-1.5" style={{ fontSize: 9 }}>Profiles</p>
                {matchedProfiles.map(a => (
                  <button key={a.id} onClick={() => { setProfileCoach(a); setQ(""); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded text-left" style={{ background: 'transparent' }}>
                    {a.avatar_url
                      ? <img src={a.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ border: a.is_coach_verified ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)' }} />
                      : <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-work text-xs font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(a.display_name || "?")[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <span className="flex items-center gap-1 font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {a.display_name}
                        {a.is_coach_verified && <BadgeCheck size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                      </span>
                      <span className="block font-elite text-[8px] uppercase tracking-widest truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {a.is_coach_verified ? "Verified Coach" : "Athlete"}{a.school ? ` · ${a.school}` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}
            {matchedVideos.length > 0 && (
              <>
                <p className="eyebrow px-2 pt-2 pb-1.5" style={{ fontSize: 9 }}>Coach Videos</p>
                {matchedVideos.map(v => (
                  <button key={v.id} onClick={() => { playOrBuy(v); setQ(""); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded text-left">
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                      <Play size={12} fill="currentColor" style={{ color: 'var(--accent)' }} />
                    </div>
                    <p className="flex-1 min-w-0 font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                    {v.price_usd > 0 && !purchasedIds.includes(v.id) && (
                      <span className="tabular-nums text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                        ${v.price_usd.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
            {matchedPrograms.length > 0 && (
              <>
                <p className="eyebrow px-2 pt-2 pb-1.5" style={{ fontSize: 9 }}>Programs</p>
                {matchedPrograms.map(p => (
                  <button key={p.id} onClick={() => { onSelectProgram(p); setQ(""); }}
                    className="w-full flex items-center gap-2.5 p-2 rounded text-left">
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                      <Dumbbell size={12} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                      <span className="block font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{p.sport} · {p.duration}m</span>
                    </div>
                  </button>
                ))}
              </>
            )}
            {noResults && (
              <p className="font-work text-xs text-center py-6" style={{ color: 'var(--text-secondary)' }}>
                No drills, coaches, or athletes match "{q.trim()}".
              </p>
            )}
          </div>
        </div>
      )}

      {/* Coaches for you — deterministic match, only when not actively searching */}
      {!searching && (
        <div className="mt-4">
          <CoachesForYou
            athlete={athlete}
            coaches={athletes.filter(a => a.role === "coach" && isCoachDiscoverable(a))}
            subscribedIds={subscribedIds}
            onOpen={setProfileCoach}
          />
        </div>
      )}

      <SortFilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        sortBy={sortBy} setSortBy={setSortBy}
        priceFilter={priceFilter} setPriceFilter={setPriceFilter}
        difficultyFilter={difficultyFilter} setDifficultyFilter={setDifficultyFilter}
      />

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
        item={buying ? { title: buying.title, price: `$${buying.price_usd?.toFixed(2)}`, coachName: athletes.find(a => a.id === buying.athlete_id)?.display_name || "Coach" } : null}
        onBuy={() => { setPurchasedIds(prev => [...prev, buying.id]); setWatching(buying); setBuying(null); }}
      />
      <ExploreVideoSheet
        open={!!watching}
        onClose={() => setWatching(null)}
        video={watching}
        author={watching ? athletes.find(a => a.id === watching.athlete_id) : null}
      />
    </div>
  );
}