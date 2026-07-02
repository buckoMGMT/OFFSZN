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
        <span className="font-elite text-[9px]" style={{ color: '#00C853' }}>{current.toLocaleString()} / {target.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#9BA3AC44' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: '#00C853' }} />
      </div>
    </div>
  );
}

function RewardCard({ item, athletePoints, onRedeem }) {
  const isMerch = item.type === "merch";
  const isUnavailable = isMerch;
  const canAfford = !isUnavailable && athletePoints >= item.points_required;
  const savings = item.real_world_value_usd
    ? `$${item.real_world_value_usd} value`
    : null;

  return (
    <div
      className="rounded border overflow-hidden relative"
      style={{
        background: '#DCDEE1',
        borderColor: item.is_featured ? '#00C853' : '#9BA3AC',
        borderWidth: item.is_featured ? 2 : 1,
        opacity: isUnavailable ? 0.6 : (canAfford ? 1 : 0.75),
      }}
    >
      {isUnavailable && (
        <div className="absolute top-2 left-2 z-10 ink-stamp" style={{ fontSize: 8, transform: 'rotate(-3deg)' }}>
          Coming Soon
        </div>
      )}
      {!isUnavailable && item.is_featured && (
        <div className="absolute top-2 left-2 z-10 ink-stamp" style={{ fontSize: 8, transform: 'rotate(-3deg)' }}>
          Featured
        </div>
      )}
      {isMerch && (
        <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded font-elite text-[8px] uppercase tracking-wide"
          style={{ background: '#5E646B', color: '#fff', transform: 'rotate(2deg)' }}>
          Brand
        </div>
      )}

      <div className="relative h-36 overflow-hidden">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: '#9BA3AC22' }} />
        }
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(21,21,26,0.8) 0%, transparent 60%)' }} />
        {savings && (
          <div className="absolute bottom-2 left-2">
            <span className="font-elite text-[9px] uppercase" style={{ color: '#fff' }}>{savings}</span>
          </div>
        )}
        {(isUnavailable || !canAfford) && (
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
            <Zap size={10} style={{ color: '#00C853' }} />
            <span className="font-elite text-sm" style={{ color: '#00C853' }}>{item.points_required.toLocaleString()}</span>
            <span className="font-elite text-[9px]" style={{ color: '#9BA3AC' }}>pts</span>
          </div>
          {isUnavailable
            ? <span className="font-elite text-[9px] uppercase" style={{ color: '#9BA3AC' }}>Unavailable</span>
            : canAfford
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
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: 'var(--theme-bg)' }}>
      <PlayDiagram size={150} />
      <p className="font-elite text-xs mt-4" style={{ color: 'var(--theme-ink-soft)' }}>Loading store…</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--theme-bg)', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-3 border-b" style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: '#15151A' }}>Locker Room</h1>
          <PageLabel number={5} />
        </div>

        {/* Points balance */}
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: '#00C853' }} />
          <span className="font-elite text-base" style={{ color: '#00C853' }}>{points.toLocaleString()}</span>
          <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: '#9BA3AC' }}>pts available</span>
        </div>

        {/* Progress to next gift card */}
        <div className="mb-3">
          <PointsBar current={points} target={10000} label="Progress to $5 Gift Card" />
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--theme-border)' }}>
          {[
            { id: "store", label: "Store" },
            { id: "referrals", label: "Recruit" },
            { id: "history", label: "My Orders" },
            { id: "howto", label: "Earn" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 font-elite text-[10px] uppercase tracking-widest"
              style={{
                color: tab === t.id ? '#00C853' : '#5A5D63',
                borderBottom: tab === t.id ? '2px solid #00C853' : '2px solid transparent',
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
                    background: filter === f.id ? '#00C853' : 'var(--theme-surface)',
                        color: filter === f.id ? '#fff' : 'var(--theme-ink-soft)',
                        border: '1px solid var(--theme-border)',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Merch nudge banner */}
            {filter !== "gift_card" && (
              <div className="rounded border-2 p-3 mb-4 flex items-start gap-3" style={{ borderColor: '#00C853', background: '#00C85312' }}>
                <Shirt size={18} style={{ color: '#00C853', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="font-elite text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#00C853' }}>Rep the Brand → Earn Faster</p>
                  <p className="font-work text-xs" style={{ color: '#5A5D63' }}>
                    Merch items cost <strong>40% fewer points</strong> than gift cards — and you become a walking billboard for OFFSZN.
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
                  <div key={r.id} className="rounded border p-4 flex items-center gap-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)' }}>
                      {r.reward_type === "merch" ? <Shirt size={16} style={{ color: '#00C853' }} /> : <Gift size={16} style={{ color: '#00C853' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{r.reward_name}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{r.points_spent.toLocaleString()} pts spent</p>
                    </div>
                    <span className="font-elite text-[9px] uppercase px-2 py-0.5 rounded"
                      style={{
                        background: r.status === "delivered" ? 'var(--theme-ink)' : 'var(--theme-surface-alt)',
                        color: r.status === "delivered" ? 'var(--theme-bg)' : '#00C853',
                        border: '1px solid var(--theme-border)',
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
            <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <h2 className="font-anton text-xl uppercase mb-1" style={{ color: 'var(--theme-ink)' }}>The Point Economy</h2>
              <p className="font-work text-xs mb-4" style={{ color: 'var(--theme-ink-soft)' }}>Consistent daily effort adds up. A $5 gift card takes ~90 days of active use.</p>
              <div className="space-y-3">
                {DAILY_BREAKDOWN.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                    <p className="font-work text-xs flex-1" style={{ color: 'var(--theme-ink)' }}>{d.action}</p>
                    <div className="flex items-center gap-1 ml-3">
                      <Zap size={10} style={{ color: '#00C853' }} />
                      <span className="font-elite text-sm" style={{ color: '#00C853' }}>+{d.pts}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <p className="font-work text-xs font-semibold" style={{ color: 'var(--theme-ink)' }}>Daily Max (all 5 tasks)</p>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: '#00C853' }} />
                    <span className="font-elite text-sm font-bold" style={{ color: '#00C853' }}>85</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <h2 className="font-anton text-xl uppercase mb-3" style={{ color: 'var(--theme-ink)' }}>Challenge Tiers</h2>
              {[
                { tier: "Bronze", pts: "5", freq: "Daily", ex: "Complete any 1 daily task", color: '#9BA3AC' },
                { tier: "Silver", pts: "15", freq: "Daily", ex: "Complete 3 of 5 daily tasks", color: '#5E646B' },
                { tier: "Gold", pts: "50", freq: "Daily", ex: "Complete all 5 daily tasks", color: '#00C853' },
              ].map(t => (
                <div key={t.tier} className="flex items-start gap-3 py-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="w-14 h-6 rounded flex items-center justify-center flex-shrink-0 font-elite text-[9px] uppercase"
                    style={{ background: t.color, color: '#fff' }}>
                    {t.tier}
                  </div>
                  <div className="flex-1">
                    <p className="font-work text-xs" style={{ color: 'var(--theme-ink)' }}>{t.ex}</p>
                    <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--theme-ink-soft)' }}>{t.freq}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: '#00C853' }} />
                    <span className="font-elite text-sm" style={{ color: '#00C853' }}>{t.pts}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <h2 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--theme-ink)' }}>Referral Bonus</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: 'var(--theme-ink)' }}>Friend joins via your link</p>
                  <span className="font-elite text-sm" style={{ color: '#00C853' }}>+500 pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: 'var(--theme-ink)' }}>Friend logs 3 workouts</p>
                  <span className="font-elite text-sm" style={{ color: '#00C853' }}>+1,500 pts</span>
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