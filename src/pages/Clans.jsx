import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Shield, Trophy, Users, X, Swords } from "lucide-react";
import ClanCard from "@/components/clans/ClanCard";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import CoachCircle from "@/components/ui/CoachCircle";
import PlayDiagram from "@/components/ui/PlayDiagram";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "other"];
const TYPES = ["high_school", "club", "college", "other"];

// Formats "Marcus Coleman" → "Marcus C."
function formatName(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// Cycles which leaderboard row gets the coach circle
function useCircledRow(count) {
  const [circled, setCircled] = useState(0);
  useEffect(() => {
    if (count === 0) return;
    const interval = setInterval(() => {
      setCircled(prev => (prev + 1) % Math.min(count, 5));
    }, 3200);
    return () => clearInterval(interval);
  }, [count]);
  return circled;
}

export default function Clans() {
  const [athlete, setAthlete] = useState(null);
  const [clans, setClans] = useState([]);
  const [myClan, setMyClan] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", type: "high_school", sport: "football", school_name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("discover");
  const circledRow = useCircledRow(clans.length);

  const load = useCallback(async () => {
    const [athletes, clanList] = await Promise.all([
      base44.entities.Athlete.list("-created_date", 1),
      base44.entities.Clan.list("-total_points", 50),
    ]);
    const a = athletes[0] || null;
    setAthlete(a);
    setClans(clanList);
    if (a?.clan_id) setMyClan(clanList.find(c => c.id === a.clan_id) || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const joinClan = async (clan) => {
    if (!athlete) return;
    await Promise.all([
      base44.entities.Clan.update(clan.id, { member_ids: [...(clan.member_ids || []), athlete.id] }),
      base44.entities.Athlete.update(athlete.id, { clan_id: clan.id }),
    ]);
    load();
  };

  const leaveClan = async () => {
    if (!athlete || !myClan) return;
    await Promise.all([
      base44.entities.Clan.update(myClan.id, { member_ids: (myClan.member_ids || []).filter(id => id !== athlete.id) }),
      base44.entities.Athlete.update(athlete.id, { clan_id: null }),
    ]);
    setMyClan(null); load();
  };

  const createClan = async () => {
    if (!createForm.name || !athlete) return;
    setCreating(true);
    const newClan = await base44.entities.Clan.create({ ...createForm, admin_id: athlete.id, member_ids: [athlete.id], total_points: 0, wins: 0, losses: 0, is_public: true });
    await base44.entities.Athlete.update(athlete.id, { clan_id: newClan.id });
    setShowCreate(false); setCreating(false); load();
  };

  const filtered = clans.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.school_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: '#EDEEF0' }}>
      <PlayDiagram size={150} />
      <p className="font-elite text-xs mt-4" style={{ color: '#5A5D63' }}>Loading teams…</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#EDEEF0', color: '#15151A' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-3 border-b" style={{ background: '#EDEEF0', borderColor: '#9BA3AC' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: '#15151A' }}>Teams</h1>
          <div className="flex items-center gap-3">
            <PageLabel number={4} />
            {!myClan && (
              <StampButton onClick={() => setShowCreate(true)}>
                <Plus size={12} /> Create
              </StampButton>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b mt-2" style={{ borderColor: '#9BA3AC' }}>
          {[
            { id: "discover", label: "Discover" },
            { id: "leaderboard", label: "Roster" },
            { id: "challenges", label: "Challenges" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 font-elite text-xs uppercase tracking-widest"
              style={{
                color: tab === t.id ? '#D7263D' : '#5A5D63',
                borderBottom: tab === t.id ? '2px solid #D7263D' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* My Clan Banner */}
        {myClan && (
          <div className="rounded border p-4 mb-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC' }}>
                <Shield size={18} style={{ color: '#D7263D' }} />
              </div>
              <div className="flex-1">
                <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>My Team</p>
                <h3 className="font-anton text-lg uppercase" style={{ color: '#15151A' }}>{myClan.name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-elite text-[9px]" style={{ color: '#5A5D63' }}><Users size={9} className="inline mr-0.5" />{(myClan.member_ids || []).length} members</span>
                  <span className="font-elite text-[9px]" style={{ color: '#D7263D' }}><Trophy size={9} className="inline mr-0.5" />{myClan.total_points} pts</span>
                </div>
              </div>
              <button onClick={leaveClan} className="p-1.5 rounded" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC' }}>
                <X size={14} style={{ color: '#5A5D63' }} />
              </button>
            </div>
            {myClan.announcement && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: '#9BA3AC' }}>
                <p className="font-marker text-sm" style={{ color: '#15151A', transform: 'rotate(-0.5deg)' }}>{myClan.announcement}</p>
              </div>
            )}
          </div>
        )}

        {tab === "discover" && (
          <>
            <div className="flex items-center gap-3 rounded px-4 py-3 mb-4 border" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
              <Search size={15} style={{ color: '#9BA3AC' }} />
              <input className="flex-1 bg-transparent text-sm font-work outline-none" style={{ color: '#15151A' }}
                placeholder="Search by school or team name…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <PlayDiagram size={140} />
                <h3 className="font-anton text-xl uppercase mt-4 mb-2" style={{ color: '#15151A' }}>No Teams Found</h3>
                <p className="font-work text-sm" style={{ color: '#5A5D63' }}>Be the first to create a team.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(clan => (
                  <div key={clan.id} className="space-y-2">
                    <ClanCard clan={clan} isJoined={myClan?.id === clan.id} onClick={!myClan ? () => joinClan(clan) : undefined} />
                    {!myClan && (
                      <StampButton onClick={() => joinClan(clan)} fullWidth>Join This Team</StampButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-anton text-2xl uppercase" style={{ color: '#15151A' }}>Global Roster</h2>
              {/* Barbell graphic — visual clip */}
              <svg width="48" height="18" viewBox="0 0 48 18" fill="none">
                <rect x="4" y="7" width="40" height="4" rx="2" fill="#9BA3AC" />
                <rect x="0" y="3" width="6" height="12" rx="2" fill="#5E646B" />
                <rect x="8" y="5" width="4" height="8" rx="1" fill="#5E646B" />
                <rect x="36" y="5" width="4" height="8" rx="1" fill="#5E646B" />
                <rect x="42" y="3" width="6" height="12" rx="2" fill="#5E646B" />
              </svg>
            </div>
            <div className="space-y-2">
              {clans.map((clan, i) => {
                const isMe = myClan?.id === clan.id;
                const isCircled = i === circledRow;
                return (
                  <div key={clan.id} className="relative rounded border p-4 flex items-center gap-4"
                    style={{
                      background: isMe ? '#D7263D10' : '#DCDEE1',
                      borderColor: isMe ? '#D7263D' : '#9BA3AC',
                    }}>
                    {isCircled && <CoachCircle />}

                    {/* Rank */}
                    <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 font-elite text-base"
                      style={{
                        background: i === 0 ? '#D7263D' : '#EDEEF0',
                        color: i === 0 ? '#fff' : '#15151A',
                        border: '1px solid #9BA3AC',
                      }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-work font-semibold truncate" style={{ color: '#15151A' }}>
                        {formatName(clan.name)}
                        {isMe && <span className="ink-stamp ml-2" style={{ fontSize: 8 }}>You</span>}
                      </p>
                      <p className="font-elite text-[9px] uppercase tracking-wide" style={{ color: '#5A5D63' }}>{(clan.member_ids || []).length} members</p>
                    </div>
                    <div className="text-right">
                      <p className="font-elite text-lg" style={{ color: i === 0 ? '#D7263D' : '#15151A' }}>{(clan.total_points || 0).toLocaleString()}</p>
                      <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>pts</p>
                    </div>
                  </div>
                );
              })}
              {clans.length === 0 && (
                <div className="text-center py-12">
                  <PlayDiagram size={130} />
                  <p className="font-work text-sm mt-4" style={{ color: '#5A5D63' }}>No teams on the board. Create the first one.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "challenges" && (
          <div className="text-center py-16">
            <Swords size={40} style={{ color: '#9BA3AC' }} className="mx-auto mb-4" />
            <h3 className="font-anton text-2xl uppercase mb-2" style={{ color: '#15151A' }}>Team Challenges</h3>
            <p className="font-work text-sm mb-6 max-w-xs mx-auto" style={{ color: '#5A5D63' }}>
              Head-to-head on macros, sleep, or workout streaks.
            </p>
            {myClan
              ? <StampButton onClick={() => {}}>Send a Challenge</StampButton>
              : <p className="font-elite text-xs uppercase" style={{ color: '#9BA3AC' }}>Join a team first.</p>
            }
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
            style={{ background: '#EDEEF0', borderColor: '#9BA3AC' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-anton text-2xl uppercase" style={{ color: '#15151A' }}>Create Team</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded" style={{ background: '#DCDEE1', border: '1px solid #9BA3AC' }}>
                <X size={18} style={{ color: '#5A5D63' }} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { placeholder: "Team name *", field: "name", type: "text" },
                { placeholder: "School / Organization", field: "school_name", type: "text" },
              ].map(({ placeholder, field }) => (
                <input key={field} className="w-full rounded px-4 py-3 text-sm font-work outline-none"
                  style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
                  placeholder={placeholder}
                  value={createForm[field]}
                  onChange={e => setCreateForm(p => ({ ...p, [field]: e.target.value }))} />
              ))}
              <select className="w-full rounded px-4 py-3 text-sm font-work outline-none"
                style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
                value={createForm.type} onChange={e => setCreateForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").toUpperCase()}</option>)}
              </select>
              <select className="w-full rounded px-4 py-3 text-sm font-work outline-none"
                style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
                value={createForm.sport} onChange={e => setCreateForm(p => ({ ...p, sport: e.target.value }))}>
                {SPORTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <textarea className="w-full rounded px-4 py-3 text-sm font-work outline-none resize-none h-20"
                style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
                placeholder="Description (optional)"
                value={createForm.description}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="mt-6 flex justify-center">
              <StampButton onClick={createClan} disabled={creating || !createForm.name} className="text-base px-8 py-3">
                {creating ? "Creating…" : "Create Team"}
              </StampButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}