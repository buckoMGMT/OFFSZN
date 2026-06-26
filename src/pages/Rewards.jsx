import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Gift, Shirt, Trophy, Users, Star, ChevronRight, X, Copy, Check, Lock, Zap, Package } from "lucide-react";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";
import RedeemModal from "@/components/rewards/RedeemModal";
import ReferralPanel from "@/components/rewards/ReferralPanel";

const DAILY_BREAKDOWN = [
  { action: "Hit your water goal (80oz)", pts: 10 },
  { action: "Hit your calorie goal", pts: 20 },
  { action: "Hit your protein target", pts: 15 },
  { action: "Complete your workout", pts: 25 },
  { action: "Log 8 hours of sleep", pts: 15 },
];

function PointsBar({ current, target, label }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{label}</span>
        <span className="font-elite text-[9px]" style={{ color: '#D7263D' }}>{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#9BA3AC44' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: '#D7263D' }} />
      </div>
    </div>
  );
}

function RewardCard({ item, athletePoints, onRedeem }) {
  const canAfford = athletePoints >= item.points_required;
  const isMerch = item.type === "merch";
  const savings = item.real_world_value_usd
    ? `$${item.real_world_value_usd} value`
    : null;

  return (
    <div
      className="rounded border overflow-hidden relative"
      style={{
        background: '#DCDEE1',
        borderColor: item.is_featured ? '#D7263D' : '#9BA3AC',
        borderWidth: item.is_featured ? 2 : 1,
        opacity: canAfford ? 1 : 0.75,
      }}
    >
      {item.is_featured && (
        <div className="absolute top-2 left-2 z-10 ink-stamp" style={{ fontSize: 8, transform: 'rotate(-3deg)' }}>
          Featured
        </div>
      )}
      {isMerch && (
        <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded font-elite text-[8px] uppercase tracking-wide"
          style={{ background: '#D7263D', color: '#fff', transform: 'rotate(2deg)' }}>
          Brand
        </div>
      )}

      <div className="relative h-36 overflow-hidden">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(21,21,26,0.8) 0%, transparent 60%)' }} />
        {savings && (
          <div className="absolute bottom-2 left-2">
            <span className="font-elite text-[9px] uppercase" style={{ color: '#fff' }}>{savings}</span>
          </div>
        )}
        {!canAfford && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(13,13,15,0.45)' }}>
            <Lock size={22} style={{ color: '#fff' }} />
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div>
          <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{item.brand}</p>
          <p className="font-work text-sm font-semibold leading-tight" style={{ color: '#15151A' }}>{item.name}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Zap size={10} style={{ color: '#D7263D' }} />
            <span className="font-elite text-sm" style={{ color: '#D7263D' }}>{item.points_required.toLocaleString()}</span>
            <span className="font-elite text-[9px]" style={{ color: '#9BA3AC' }}>pts</span>
          </div>
          {canAfford
            ? <StampButton onClick={() => onRedeem(item)} className="text-[10px] px-3 py-1">Redeem</StampButton>
            : (
              <span className="font-elite text-[9px] uppercase" style={{ color: '#9BA3AC' }}>
                {(item.points_required - athletePoints).toLocaleString()} more
              </span>
            )
          }
        </div>
      </div>
    </div>
  );
}

export default function Rewards() {
  const [athlete, setAthlete] = useState(null);
  const [items, setItems] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("store");
  const [filter, setFilter] = useState("all");
  const [redeemTarget, setRedeemTarget] = useState(null);

  const load = useCallback(async () => {
    const [athletes, rewardItems] = await Promise.all([
      base44.entities.Athlete.list("-created_date", 1),
      base44.entities.RewardItem.filter({ is_active: true }),
    ]);
    const a = athletes[0] || null;
    setAthlete(a);
    setItems(rewardItems);
    if (a) {
      const [reds, refs] = await Promise.all([
        base44.entities.Redemption.filter({ athlete_id: a.id }),
        base44.entities.Referral.filter({ referrer_athlete_id: a.id }),
      ]);
      setRedemptions(reds);
      setReferrals(refs);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRedeemed = async (item, address) => {
    await base44.entities.Redemption.create({
      athlete_id: athlete.id,
      reward_item_id: item.id,
      reward_name: item.name,
      reward_type: item.type,
      points_spent: item.points_required,
      shipping_address: address || "",
      status: "pending",
    });
    await base44.entities.Athlete.update(athlete.id, {
      total_points: Math.max(0, (athlete.total_points || 0) - item.points_required),
    });
    setAthlete(prev => ({ ...prev, total_points: Math.max(0, (prev.total_points || 0) - item.points_required) }));
    setRedeemTarget(null);
    load();
  };

  const points = athlete?.total_points || 0;
  const filtered = filter === "all" ? items : items.filter(i => i.type === filter);

  // Sort: merch first (brand preference nudge), then by points
  const sorted = [...filtered].sort((a, b) => {
    if (a.type === "merch" && b.type !== "merch") return -1;
    if (b.type === "merch" && a.type !== "merch") return 1;
    return a.points_required - b.points_required;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: '#EDEEF0' }}>
      <PlayDiagram size={150} />
      <p className="font-elite text-xs mt-4" style={{ color: '#5A5D63' }}>Loading store…</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#EDEEF0', color: '#15151A' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-3 border-b" style={{ background: '#EDEEF0', borderColor: '#9BA3AC' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: '#15151A' }}>Locker Room</h1>
          <PageLabel number={5} />
        </div>

        {/* Points balance */}
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: '#D7263D' }} />
          <span className="font-elite text-base" style={{ color: '#D7263D' }}>{points.toLocaleString()}</span>
          <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: '#9BA3AC' }}>pts available</span>
        </div>

        {/* Progress to next gift card */}
        <div className="mb-3">
          <PointsBar current={points} target={10000} label="Progress to $5 Gift Card" />
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: '#9BA3AC' }}>
          {[
            { id: "store", label: "Store" },
            { id: "referrals", label: "Recruit" },
            { id: "history", label: "My Orders" },
            { id: "howto", label: "Earn" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 font-elite text-[10px] uppercase tracking-widest"
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

        {/* STORE TAB */}
        {tab === "store" && (
          <>
            {/* Filter pills */}
            <div className="flex gap-2 mb-4">
              {[
                { id: "all", label: "All" },
                { id: "merch", label: "🏷 Brand Merch" },
                { id: "gift_card", label: "🎁 Gift Cards" },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className="px-3 py-1 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={{
                    background: filter === f.id ? '#D7263D' : '#DCDEE1',
                    color: filter === f.id ? '#fff' : '#5A5D63',
                    border: '1px solid #9BA3AC',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Merch nudge banner */}
            {filter !== "gift_card" && (
              <div className="rounded border-2 p-3 mb-4 flex items-start gap-3" style={{ borderColor: '#D7263D', background: '#D7263D12' }}>
                <Shirt size={18} style={{ color: '#D7263D', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-elite text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#D7263D' }}>Rep the Brand → Earn Faster</p>
                  <p className="font-work text-xs" style={{ color: '#5A5D63' }}>
                    Merch items cost <strong>40% fewer points</strong> than gift cards — and you become a walking billboard for Playbook Pro.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {sorted.map(item => (
                <RewardCard key={item.id} item={item} athletePoints={points} onRedeem={setRedeemTarget} />
              ))}
            </div>
          </>
        )}

        {/* REFERRALS TAB */}
        {tab === "referrals" && (
          <ReferralPanel athlete={athlete} referrals={referrals} onReferred={load} />
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div>
            {redemptions.length === 0 ? (
              <div className="text-center py-16">
                <Package size={40} style={{ color: '#9BA3AC' }} className="mx-auto mb-4" />
                <h3 className="font-anton text-xl uppercase mb-2" style={{ color: '#15151A' }}>No Orders Yet</h3>
                <p className="font-work text-sm" style={{ color: '#5A5D63' }}>Keep earning and redeem your first reward.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {redemptions.map(r => (
                  <div key={r.id} className="rounded border p-4 flex items-center gap-3" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC' }}>
                      {r.reward_type === "merch" ? <Shirt size={16} style={{ color: '#D7263D' }} /> : <Gift size={16} style={{ color: '#D7263D' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: '#15151A' }}>{r.reward_name}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{r.points_spent.toLocaleString()} pts spent</p>
                    </div>
                    <span className="font-elite text-[9px] uppercase px-2 py-0.5 rounded"
                      style={{
                        background: r.status === "delivered" ? '#15151A' : '#EDEEF0',
                        color: r.status === "delivered" ? '#fff' : '#D7263D',
                        border: '1px solid #9BA3AC',
                      }}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HOW TO EARN TAB */}
        {tab === "howto" && (
          <div className="space-y-4">
            <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
              <h2 className="font-anton text-xl uppercase mb-1" style={{ color: '#15151A' }}>The Point Economy</h2>
              <p className="font-work text-xs mb-4" style={{ color: '#5A5D63' }}>Consistent daily effort adds up. A $5 gift card takes ~90 days of active use.</p>
              <div className="space-y-3">
                {DAILY_BREAKDOWN.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#9BA3AC44' }}>
                    <p className="font-work text-xs flex-1" style={{ color: '#15151A' }}>{d.action}</p>
                    <div className="flex items-center gap-1 ml-3">
                      <Zap size={10} style={{ color: '#D7263D' }} />
                      <span className="font-elite text-sm" style={{ color: '#D7263D' }}>+{d.pts}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <p className="font-work text-xs font-semibold" style={{ color: '#15151A' }}>Daily Max (all 5 tasks)</p>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: '#D7263D' }} />
                    <span className="font-elite text-sm font-bold" style={{ color: '#D7263D' }}>85</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
              <h2 className="font-anton text-xl uppercase mb-3" style={{ color: '#15151A' }}>Challenge Tiers</h2>
              {[
                { tier: "Bronze", pts: "5", freq: "Daily", ex: "Complete any 1 daily task", color: '#9BA3AC' },
                { tier: "Silver", pts: "15", freq: "Daily", ex: "Complete 3 of 5 daily tasks", color: '#5E646B' },
                { tier: "Gold", pts: "50", freq: "Daily", ex: "Complete all 5 daily tasks", color: '#D7263D' },
              ].map(t => (
                <div key={t.tier} className="flex items-start gap-3 py-3 border-b" style={{ borderColor: '#9BA3AC44' }}>
                  <div className="w-14 h-6 rounded flex items-center justify-center flex-shrink-0 font-elite text-[9px] uppercase"
                    style={{ background: t.color, color: '#fff' }}>
                    {t.tier}
                  </div>
                  <div className="flex-1">
                    <p className="font-work text-xs" style={{ color: '#15151A' }}>{t.ex}</p>
                    <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: '#5A5D63' }}>{t.freq}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: '#D7263D' }} />
                    <span className="font-elite text-sm" style={{ color: '#D7263D' }}>{t.pts}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded border p-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
              <h2 className="font-anton text-xl uppercase mb-2" style={{ color: '#15151A' }}>Referral Bonus</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: '#15151A' }}>Friend joins via your link</p>
                  <span className="font-elite text-sm" style={{ color: '#D7263D' }}>+500 pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: '#15151A' }}>Friend logs 3 workouts</p>
                  <span className="font-elite text-sm" style={{ color: '#D7263D' }}>+1,500 pts</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {redeemTarget && (
        <RedeemModal item={redeemTarget} onClose={() => setRedeemTarget(null)} onConfirm={onRedeemed} />
      )}
    </div>
  );
}