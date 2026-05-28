import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Shield, Trophy, Users, X, Swords } from "lucide-react";
import ClanCard from "@/components/clans/ClanCard";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "other"];
const TYPES = ["high_school", "club", "college", "other"];

export default function Clans() {
  const [athlete, setAthlete] = useState(null);
  const [clans, setClans] = useState([]);
  const [myClan, setMyClan] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", type: "high_school", sport: "football", school_name: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("discover"); // discover | leaderboard | challenges

  const load = useCallback(async () => {
    const [athletes, clanList] = await Promise.all([
      base44.entities.Athlete.list("-created_date", 1),
      base44.entities.Clan.list("-total_points", 50),
    ]);
    const a = athletes[0] || null;
    setAthlete(a);
    setClans(clanList);
    if (a?.clan_id) {
      const found = clanList.find(c => c.id === a.clan_id);
      setMyClan(found || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const joinClan = async (clan) => {
    if (!athlete) return;
    const newMembers = [...(clan.member_ids || []), athlete.id];
    await Promise.all([
      base44.entities.Clan.update(clan.id, { member_ids: newMembers }),
      base44.entities.Athlete.update(athlete.id, { clan_id: clan.id }),
    ]);
    load();
  };

  const leaveClan = async () => {
    if (!athlete || !myClan) return;
    const newMembers = (myClan.member_ids || []).filter(id => id !== athlete.id);
    await Promise.all([
      base44.entities.Clan.update(myClan.id, { member_ids: newMembers }),
      base44.entities.Athlete.update(athlete.id, { clan_id: null }),
    ]);
    setMyClan(null);
    load();
  };

  const createClan = async () => {
    if (!createForm.name || !athlete) return;
    setCreating(true);
    const newClan = await base44.entities.Clan.create({
      ...createForm,
      admin_id: athlete.id,
      member_ids: [athlete.id],
      total_points: 0,
      wins: 0,
      losses: 0,
      is_public: true,
    });
    await base44.entities.Athlete.update(athlete.id, { clan_id: newClan.id });
    setShowCreate(false);
    setCreating(false);
    load();
  };

  const filtered = clans.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.school_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-barlow font-bold text-foreground uppercase">Clans</h1>
            <p className="text-xs text-muted-foreground font-barlow uppercase tracking-widest">Compete together. Win together.</p>
          </div>
          {!myClan && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 gradient-gold text-primary-foreground px-4 py-2.5 rounded-xl font-barlow font-bold uppercase text-sm gold-glow">
              <Plus size={16} />Create
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          {[
            { id: "discover", label: "Discover" },
            { id: "leaderboard", label: "Rankings" },
            { id: "challenges", label: "Challenges" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-barlow font-bold uppercase transition-all ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* My Clan Banner */}
        {myClan && (
          <div className="gradient-card border border-primary/40 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Shield size={24} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-primary font-barlow uppercase font-bold tracking-wider mb-0.5">My Clan</p>
                <h3 className="text-lg font-barlow font-bold text-foreground uppercase">{myClan.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Users size={10} />{(myClan.member_ids || []).length} members</span>
                  <span className="text-xs text-primary font-barlow font-bold flex items-center gap-1"><Trophy size={10} />{myClan.total_points} pts</span>
                </div>
              </div>
              <button onClick={leaveClan} className="p-2 rounded-xl bg-destructive/15 text-destructive">
                <X size={16} />
              </button>
            </div>
            {myClan.announcement && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">{myClan.announcement}</p>
              </div>
            )}
          </div>
        )}

        {tab === "discover" && (
          <>
            <div className="flex items-center gap-3 bg-secondary rounded-xl px-4 py-3 mb-4">
              <Search size={16} className="text-muted-foreground" />
              <input
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Search by school or clan name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <Shield size={48} className="text-muted-foreground mx-auto mb-4 opacity-40" />
                <h3 className="text-xl font-barlow font-bold text-foreground uppercase mb-2">No Clans Found</h3>
                <p className="text-sm text-muted-foreground">Be the first to create a clan for your school.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(clan => (
                  <div key={clan.id} className="space-y-2">
                    <ClanCard
                      clan={clan}
                      isJoined={myClan?.id === clan.id}
                      onClick={!myClan && clan.id !== myClan?.id ? () => joinClan(clan) : undefined}
                    />
                    {!myClan && (
                      <button
                        onClick={() => joinClan(clan)}
                        className="w-full py-2.5 border border-primary/40 text-primary text-xs font-barlow font-bold uppercase rounded-xl hover:bg-primary/10 transition-colors"
                      >
                        Join This Clan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <div>
            <h2 className="text-xl font-barlow font-bold text-foreground uppercase mb-3">Global Rankings</h2>
            <div className="space-y-2">
              {clans.map((clan, i) => (
                <div key={clan.id} className={`gradient-card border rounded-xl p-4 flex items-center gap-4 ${
                  myClan?.id === clan.id ? "border-primary/40" : "border-border"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-barlow font-bold text-sm ${
                    i === 0 ? "bg-primary text-primary-foreground" :
                    i === 1 ? "bg-secondary text-foreground" :
                    i === 2 ? "bg-orange-500/20 text-orange-400" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-barlow font-bold text-foreground uppercase truncate">{clan.name}</p>
                    <p className="text-xs text-muted-foreground">{(clan.member_ids || []).length} members</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-barlow font-bold text-primary">{clan.total_points || 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">pts</p>
                  </div>
                </div>
              ))}
              {clans.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">No clans yet. Create the first one!</div>
              )}
            </div>
          </div>
        )}

        {tab === "challenges" && (
          <div className="text-center py-16">
            <Swords size={48} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="text-xl font-barlow font-bold text-foreground uppercase mb-2">Clan Challenges</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
              Challenge rival clans to head-to-head battles on macros, sleep, or workout streaks.
            </p>
            {myClan ? (
              <button className="gradient-gold text-primary-foreground px-8 py-3 rounded-xl font-barlow font-bold uppercase text-base gold-glow">
                Send a Challenge
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">Join a clan first to issue challenges.</p>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-barlow font-bold text-foreground uppercase">Create Clan</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl bg-secondary text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Clan name *" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} />
              <select className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
                value={createForm.type} onChange={e => setCreateForm(p => ({ ...p, type: e.target.value }))}>
                {TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ").toUpperCase()}</option>)}
              </select>
              <select className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
                value={createForm.sport} onChange={e => setCreateForm(p => ({ ...p, sport: e.target.value }))}>
                {SPORTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="School / Organization name" value={createForm.school_name} onChange={e => setCreateForm(p => ({ ...p, school_name: e.target.value }))} />
              <textarea className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20"
                placeholder="Description (optional)" value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <button onClick={createClan} disabled={creating || !createForm.name}
              className="w-full mt-6 gradient-gold text-primary-foreground py-4 rounded-2xl font-barlow font-bold uppercase text-lg tracking-widest gold-glow disabled:opacity-50">
              {creating ? "Creating..." : "Create Clan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}