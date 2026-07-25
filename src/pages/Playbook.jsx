import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Play, Clock, Target, Bookmark, BookmarkCheck, Plus, X, ListVideo, Dumbbell, TrendingUp, ChevronLeft, Share2 } from "lucide-react";
import PageHero from "@/components/ui/PageHero";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";
import PremiumGate from "@/components/ui/PremiumGate";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import EmptyState from "@/components/ui/EmptyState";
import ExploreGrid from "@/components/playbook/ExploreGrid";
import DiscoveryBar from "@/components/playbook/DiscoveryBar";
import ForYouRow from "@/components/playbook/ForYouRow";
import SubscriptionsTab from "@/components/playbook/SubscriptionsTab";
import NotificationBell from "@/components/notifications/NotificationBell";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";
import PassRibbon from "@/components/monetization/PassRibbon";
import PullToRefresh from "@/components/layout/PullToRefresh";
import useTabState from "@/lib/useTabState";
import WorkoutRunner from "@/components/workout/WorkoutRunner";
import PlaylistDetail from "@/components/playbook/PlaylistDetail";
import { PLAYLIST_ICONS, PlaylistIcon, DEFAULT_PLAYLIST_ICON } from "@/components/playbook/playlistIcons";
import useSheetBack from "@/lib/useSheetBack";
import { buildStepsFromProgram, buildStepsFromPlaylist } from "@/lib/workoutSteps";
import { useMiniPlayer } from "@/lib/MiniPlayerContext";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";

const SPORT_FILTERS = ["All", "Football", "Basketball", "Baseball", "Soccer", "Track", "Volleyball", "Wrestling", "Boxing", "MMA", "Swimming", "Lacrosse"];

// Placeholder catalog removed pre-launch (incl. third-party YouTube embeds —
// resolves the Content Rights contradiction). Real drills come from coach
// uploads (UserVideoSubmission) rendered by ExploreGrid.
const PROGRAMS = [];

// Tiny X's/O's icon for program cards
function XsOs({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="8" cy="8" r="4" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="8" r="4" stroke="var(--text-tertiary)" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="19" x2="11" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="11" y1="19" x2="5" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="17" y1="19" x2="23" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="23" y1="19" x2="17" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function difficultyNum(d) {
  return d === "Beginner" ? "01" : d === "Intermediate" ? "02" : "03";
}

export default function Playbook() {
  const [athlete, setAthlete] = useState(null);
  const [sportFilter, setSportFilter] = useTabState("playbook.sport", "All");
  // §4 — the open drill detail survives tab swaps: persist the id, resolve the object
  const [selectedId, setSelectedId] = useTabState("playbook.selected", "");
  const selected = selectedId ? PROGRAMS.find(p => String(p.id) === selectedId) || null : null;
  const setSelected = (p) => {
    setSelectedId(p ? String(p.id) : "");
    // Track recently watched — feeds playlist suggestions
    if (p) {
      const recent = JSON.parse(localStorage.getItem("pb_recent_programs") || "[]").filter(id => id !== p.id);
      localStorage.setItem("pb_recent_programs", JSON.stringify([p.id, ...recent].slice(0, 10)));
    }
  };
  const [savedIds, setSavedIds] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [tab, setTab] = useTabState("playbook.tab", "explore");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistIcon, setPlaylistIcon] = useState(DEFAULT_PLAYLIST_ICON);
  const [playlistPrograms, setPlaylistPrograms] = useState([]);
  const [openPlaylistId, setOpenPlaylistId] = useState("");
  const openPlaylist = playlists.find(p => p.id === openPlaylistId) || null;
  // Sheets hide the dock + participate in back navigation
  useSheetBack(showCreatePlaylist, () => setShowCreatePlaylist(false));
  const [showPaywall, setShowPaywall] = useState(false);
  const [runner, setRunner] = useState(null); // { title, steps, duration } — active workout session
  const { openPlayer } = useMiniPlayer();
  const [coachProfile, setCoachProfile] = useState(null); // coach attribution chip → profile sheet
  const [sortBy, setSortBy] = useState("featured");
  const [priceFilter, setPriceFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");

  const load = useCallback(async () => {
    const list = await base44.entities.Athlete.list("-created_date", 1);
    const a = list[0] || null;
    setAthlete(a);
    if (a) {
      const [saved, pls] = await Promise.all([
        base44.entities.SavedWorkout.filter({ athlete_id: a.id }),
        base44.entities.Playlist.filter({ athlete_id: a.id }),
      ]);
      setSavedIds(saved.map(s => s.program_id));
      setPlaylists(pls);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isPremium = athlete?.subscription_tier === "premium";

  // §5 — optimistic save: UI flips immediately, server reconciles, rollback on failure
  const toggleSave = async (program, e) => {
    e.stopPropagation();
    if (!isPremium || !athlete) return;
    const wasSaved = savedIds.includes(program.id);
    setSavedIds(prev => wasSaved ? prev.filter(id => id !== program.id) : [...prev, program.id]);
    try {
      if (wasSaved) {
        const saved = await base44.entities.SavedWorkout.filter({ athlete_id: athlete.id, program_id: program.id });
        if (saved[0]) await base44.entities.SavedWorkout.delete(saved[0].id);
      } else {
        await base44.entities.SavedWorkout.create({ athlete_id: athlete.id, program_id: program.id });
      }
    } catch {
      // Roll back visibly on failure
      setSavedIds(prev => wasSaved ? [...prev, program.id] : prev.filter(id => id !== program.id));
    }
  };

  const createPlaylist = async () => {
    if (!playlistName || !athlete) return;
    const p = await base44.entities.Playlist.create({ name: playlistName, athlete_id: athlete.id, program_ids: playlistPrograms, icon: playlistIcon });
    setPlaylists(prev => [...prev, p]);
    setShowCreatePlaylist(false); setPlaylistName(""); setPlaylistPrograms([]); setPlaylistIcon(DEFAULT_PLAYLIST_ICON);
  };

  let filtered = PROGRAMS.filter(p =>
    (sportFilter === "All" || p.sport === sportFilter) &&
    (difficultyFilter === "all" || p.difficulty.toLowerCase() === difficultyFilter) &&
    (priceFilter === "all" || (priceFilter === "paid" ? p.isPremium : !p.isPremium))
  );
  if (sortBy === "newest") filtered = [...filtered].sort((a, b) => b.id - a.id);
  else if (sortBy === "price_low") filtered = [...filtered].sort((a, b) => (a.isPremium ? 1 : 0) - (b.isPremium ? 1 : 0));
  else if (sortBy === "price_high") filtered = [...filtered].sort((a, b) => (b.isPremium ? 1 : 0) - (a.isPremium ? 1 : 0));
  const savedPrograms = PROGRAMS.filter(p => savedIds.includes(p.id));

  // Detail view
  if (selected) {
    const isSaved = savedIds.includes(selected.id);
    const locked = selected.isPremium && !isPremium;
    return (
      <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
        {/* Hero — drill thumbnail scrimmed to tokens, title + meta over it */}
        <div className="relative">
          <PageHero imageUrl={locked ? undefined : selected.cover} height={220}>
            <p className="font-elite text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>{selected.category} · {selected.sport}</p>
            <h1 className="font-anton text-2xl uppercase leading-tight" style={{ color: '#fff' }}>
              {locked ? "All-SZN Program" : selected.title}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.85)' }}>{locked ? "Unlock with the All-SZN Pass." : selected.aim}</p>
          </PageHero>
          <button onClick={() => setSelected(null)}
            className="absolute top-4 left-4 p-2 rounded-full" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <ChevronLeft size={18} style={{ color: '#fff' }} />
          </button>
        </div>

        <div className="px-4 pt-4 pb-8">
          {/* Coach attribution chip → opens their profile */}
          {selected.coach && (
            <button onClick={() => setCoachProfile(selected.coach)}
              className="inline-flex items-center gap-2 mb-4 pl-1 pr-3 py-1 rounded-full"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              {selected.coach.avatar_url
                ? <img src={selected.coach.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                : <div className="w-6 h-6 rounded-full flex items-center justify-center font-work text-[10px]" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(selected.coach.display_name || "C")[0]}</div>}
              <span className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.coach.display_name}</span>
            </button>
          )}

          {/* Meta rows — EQUIPMENT / DURATION / DIFFICULTY */}
          <div className="card-base divide-y mb-4" style={{ borderColor: 'var(--border-subtle)' }}>
            {[
              { icon: Dumbbell, label: "Equipment", value: (selected.targeted_areas || []).join(", ") || "None" },
              { icon: Clock, label: "Duration", value: `${selected.duration} min` },
              { icon: TrendingUp, label: "Difficulty", value: selected.difficulty },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <Icon size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="eyebrow flex-1">{label}</span>
                <span className="font-work text-sm font-semibold text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>

          <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>

          {locked ? (
            <PremiumGate
              title="All-SZN Pass Required"
              subtitle="The full library opens with the All-SZN Pass."
              onUpgrade={() => setShowPaywall(true)}
            />
          ) : (
            <div className="space-y-2">
              {/* START DRILL — enters the shared player/runner */}
              <button className="btn-primary w-full"
                onClick={() => {
                  if (selected.video_url) openPlayer({ url: selected.video_url, title: selected.title, author: selected.coach?.display_name });
                  else setRunner({ title: selected.title, steps: buildStepsFromProgram(selected), duration: selected.duration });
                }}>
                <Play size={14} fill="currentColor" /> Start Drill
              </button>
              {/* SAVE TO LIBRARY — ghost */}
              <button onClick={(e) => isPremium ? toggleSave(selected, e) : setShowPaywall(true)}
                className="btn-secondary w-full">
                {isSaved ? <BookmarkCheck size={14} style={{ color: 'var(--accent)' }} /> : <Bookmark size={14} />}
                {isSaved ? "Saved to Library" : "Save to Library"}
              </button>
            </div>
          )}
        </div>
        {runner && athlete && (
          <WorkoutRunner title={runner.title} steps={runner.steps} athlete={athlete} durationMinutes={runner.duration} onClose={() => setRunner(null)} />
        )}
        <CoachProfileSheet open={!!coachProfile} onClose={() => setCoachProfile(null)} coach={coachProfile} videos={[]} />
        <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky z-40 px-4 pt-3 pb-3 border-b" style={{ top: 'var(--topbar-h)', background: 'color-mix(in srgb, var(--surface-0) 85%, transparent)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: 'var(--text-primary)' }}>Drills</h1>
          <div className="flex items-center gap-2">
            <NotificationBell athlete={athlete} />
            <PageLabel number={3} />
          </div>
        </div>
        <p className="eyebrow mb-3">Training Programs — Select a Drill</p>

        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            { id: "explore", label: "Explore" },
            { id: "subs", label: "Subs" },
            { id: "saved", label: `Saved${savedIds.length ? ` (${savedIds.length})` : ""}` },
            { id: "playlists", label: "Playlists" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 font-elite text-xs uppercase tracking-widest"
              style={{
                color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "explore" && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
            {SPORT_FILTERS.map(sport => (
              <button key={sport} onClick={() => setSportFilter(sport)}
                className="flex-shrink-0 px-3 py-1 rounded font-elite text-[10px] uppercase tracking-widest transition-all"
                style={{
                  background: sportFilter === sport ? 'var(--accent)' : 'var(--surface-1)',
                  color: sportFilter === sport ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}>
                {sport}
              </button>
            ))}
          </div>
        )}
      </div>

      <PullToRefresh onRefresh={load}>
      <div className="px-4 py-4" style={{ paddingBottom: 'calc(var(--bottomnav-h) + 24px)' }}>
        {tab === "explore" && (
          <>
            <DiscoveryBar
              athlete={athlete}
              programs={PROGRAMS}
              onSelectProgram={setSelected}
              sortBy={sortBy} setSortBy={setSortBy}
              priceFilter={priceFilter} setPriceFilter={setPriceFilter}
              difficultyFilter={difficultyFilter} setDifficultyFilter={setDifficultyFilter}
            />
            {/* Picked for your SZN — deterministic, instant, refreshed daily */}
            {sportFilter === "All" && <ForYouRow athlete={athlete} programs={PROGRAMS} onSelect={setSelected} />}
            <ExploreGrid
              programs={filtered}
              sportFilter={sportFilter}
              isPremium={isPremium}
              athlete={athlete}
              sortBy={sortBy}
              priceFilter={priceFilter}
              difficultyFilter={difficultyFilter}
              onSelectProgram={setSelected}
              onLockedProgram={() => setShowPaywall(true)}
            />
          </>
        )}

        {tab === "subs" && <SubscriptionsTab athlete={athlete} />}

        {tab === "saved" && (
          <div>
            {!isPremium ? (
              <div className="mt-4">
                <PremiumGate title="Saved Programs" subtitle="Save your favorite drills and build custom playlists with the All-SZN Pass." onUpgrade={() => setShowPaywall(true)} />
              </div>
            ) : savedPrograms.length === 0 ? (
              <EmptyState title="Nothing Saved Yet." body="Tap the bookmark icon on any program to save it." />
            ) : (
              <div className="space-y-3">
                {savedPrograms.map(program => (
                  <div key={program.id} className="rounded border p-3 flex items-center gap-3 cursor-pointer" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }} onClick={() => setSelected(program)}>
                    <img src={program.cover} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" style={{ border: '1px solid var(--theme-border)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{program.title}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--theme-ink-soft)' }}>{program.duration}m · LVL {difficultyNum(program.difficulty)}</p>
                    </div>
                    <span className="font-elite text-[9px]" style={{ color: 'var(--theme-border)' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "playlists" && (
          <div>
            {!isPremium ? (
              <div className="mt-4">
                <PremiumGate title="Custom Playlists" subtitle="Create and organize your own training playlists with the All-SZN Pass." onUpgrade={() => setShowPaywall(true)} />
              </div>
            ) : (
              <>
                <div className="mb-4 flex justify-center">
                  <StampButton onClick={() => setShowCreatePlaylist(true)}>
                    <Plus size={12} /> New Playlist
                  </StampButton>
                </div>
                {playlists.length === 0 ? (
                  <EmptyState title="No Playlists Yet." body="Build one from any drill and it lands here." />
                ) : (
                  <div className="space-y-3">
                    {playlists.map(pl => (
                      <div key={pl.id} className="rounded border p-4 flex items-center gap-3 cursor-pointer" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}
                        onClick={() => setOpenPlaylistId(pl.id)}>
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                          <PlaylistIcon name={pl.icon} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-work font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{pl.name}</p>
                          <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{(pl.program_ids || []).length} programs</p>
                        </div>
                        {(pl.program_ids || []).length > 0 && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const progs = (pl.program_ids || []).map(id => PROGRAMS.find(p => p.id === id)).filter(Boolean);
                            if (progs.length) setRunner({ title: pl.name, steps: buildStepsFromPlaylist(progs), duration: progs.reduce((s, p) => s + p.duration, 0) });
                          }} className="p-1.5 rounded" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                            <Play size={13} fill="var(--accent)" style={{ color: 'var(--accent)' }} />
                          </button>
                        )}
                        <span className="font-elite text-[9px]" style={{ color: 'var(--theme-border)' }}>→</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      </PullToRefresh>

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-anton text-xl uppercase" style={{ color: 'var(--theme-ink)' }}>New Playlist</h3>
              <button onClick={() => setShowCreatePlaylist(false)} className="p-1.5 rounded" style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }} aria-label="Close">
                <X size={16} style={{ color: 'var(--theme-ink-soft)' }} />
              </button>
            </div>
            <input className="w-full rounded px-4 py-3 text-sm font-work outline-none mb-4"
              style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
              placeholder="Playlist name"
              value={playlistName} onChange={e => setPlaylistName(e.target.value)} />
            {/* Icon picker — the playlist's cover art */}
            <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--theme-ink-soft)' }}>Pick an Icon</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
              {Object.keys(PLAYLIST_ICONS).map(key => (
                <button key={key} onClick={() => setPlaylistIcon(key)}
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: playlistIcon === key ? 'var(--accent-subtle)' : 'var(--theme-surface)',
                    border: playlistIcon === key ? '2px solid var(--accent)' : '1px solid var(--theme-border)',
                  }}>
                  <PlaylistIcon name={key} size={20} color={playlistIcon === key ? 'var(--accent)' : 'var(--text-secondary)'} />
                </button>
              ))}
            </div>
            <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--theme-ink-soft)' }}>Add Programs — recently watched first</p>
            <div className="space-y-2 mb-5">
              {(() => {
                // Recently watched programs float to the top as suggestions
                const recent = JSON.parse(localStorage.getItem("pb_recent_programs") || "[]");
                return [...PROGRAMS].sort((a, b) => {
                  const ai = recent.indexOf(a.id), bi = recent.indexOf(b.id);
                  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                });
              })().map(p => {
                const included = playlistPrograms.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setPlaylistPrograms(prev => included ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    className="w-full flex items-center gap-3 p-2.5 rounded border text-left"
                    style={{ border: included ? '2px solid var(--accent)' : '1px solid var(--theme-border)', background: included ? 'var(--accent-subtle)' : 'var(--theme-surface)' }}>
                    <img src={p.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{p.title}</p>
                      <p className="font-elite text-[9px] uppercase" style={{ color: 'var(--theme-ink-soft)' }}>{p.duration}m</p>
                    </div>
                    {included && <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center">
              <StampButton onClick={createPlaylist} disabled={!playlistName}>
                Create ({playlistPrograms.length} programs)
              </StampButton>
            </div>
          </div>
        </div>
      )}

      {/* Playlist detail — Apple Music-style view / edit / play */}
      {openPlaylist && (
        <PlaylistDetail
          playlist={openPlaylist}
          allPrograms={PROGRAMS}
          onClose={() => setOpenPlaylistId("")}
          onPlay={(progs) => setRunner({ title: openPlaylist.name, steps: buildStepsFromPlaylist(progs), duration: progs.reduce((s, p) => s + p.duration, 0) })}
          onOpenProgram={(p) => { setOpenPlaylistId(""); setSelected(p); }}
          onSaved={(updated) => setPlaylists(prev => prev.map(x => x.id === updated.id ? updated : x))}
          onDeleted={(id) => setPlaylists(prev => prev.filter(x => x.id !== id))}
        />
      )}

      {runner && athlete && (
        <WorkoutRunner title={runner.title} steps={runner.steps} athlete={athlete} durationMinutes={runner.duration} onClose={() => setRunner(null)} />
      )}
      <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}