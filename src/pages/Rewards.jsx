import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Gift, Shirt, Trophy, Users, Star, ChevronRight, X, Copy, Check, Lock, Zap, Package } from "lucide-react";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";
import RedeemModal from "@/components/rewards/RedeemModal";
import ReferralPanel from "@/components/rewards/ReferralPanel";
import useTabState from "@/lib/useTabState";

// The store is intentionally dark until rewards are ready to fulfill.
// The goal progress bar mirrors the store 1:1 — no store, no goal bar.
const STORE_LIVE = false;

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
        <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
        <span className="font-elite text-[9px]" style={{ color: 'var(--accent)' }}>{current.toLocaleString()} / {target.toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#9BA3AC44' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  );
}

function RewardCard({ item, athletePoints, onRedeem }) {
  const isMerch = item.type === "merch";
  const isUnavailable = isMerch;
  const canAfford = !isUnavailable && athletePoints >= item.points_required;
  // Only gift cards show their dollar value — merch stays value-free
  const savings = !isMerch && item.real_world_value_usd
    ? `$${item.real_world_value_usd} value`
    : null;

  return (
    <div
      className="rounded border overflow-hidden relative"
      style={{
        background: 'var(--surface-1)',
        borderColor: item.is_featured ? 'var(--accent)' : 'var(--border-subtle)',
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
          <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{item.brand}</p>
          <p className="font-work text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Zap size={10} style={{ color: 'var(--accent)' }} />
            <span className="tabular-nums text-sm font-semibold" style={{ color: 'var(--accent)' }}>{item.points_required.toLocaleString()}</span>
            <span className="font-work text-[9px] uppercase" style={{ color: 'var(--text-tertiary)' }}>pts</span>
          </div>
          {isUnavailable
            ? (
              <span className="font-work text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap px-2 py-0.5 rounded"
                style={{ color: 'var(--accent)', background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                Coming Soon
              </span>
            )
            : canAfford
              ? <StampButton onClick={() => onRedeem(item)} className="text-[10px] px-3 py-1">Redeem</StampButton>
              : (
                <span className="font-work text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap px-2 py-0.5 rounded"
                  style={{ color: 'var(--warning)', background: 'rgba(245,184,65,0.12)' }}>
                  {(item.points_required - athletePoints).toLocaleString()} to go
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
  const [tab, setTab] = useTabState("rewards.tab", "store");
  const [filter, setFilter] = useState("all");
  const [redeemTarget, setRedeemTarget] = useState(null);
  // Athlete-picked reward goal — progress bar + copy track THEIR target
  const [goalItemId, setGoalItemId] = useState(() => localStorage.getItem("pb_reward_goal") || "");
  const [showGoalPicker, setShowGoalPicker] = useState(false);

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
    // Everything happens server-side in redeemReward: eligibility (90 days +
    // 60 logged days + clean standing), live balance check, and the deduction.
    try {
      const res = await base44.functions.invoke("redeemReward", { rewardItemId: item.id, shippingAddress: address || "" });
      setAthlete(prev => ({ ...prev, total_points: res.data?.new_balance ?? prev.total_points }));
    } catch (e) {
      const d = e.response?.data;
      const progress = d?.accountAgeDays != null
        ? ` (${d.accountAgeDays}/${d.requiredDays || 90} days on OFFSZN · ${d.loggedDays ?? 0}/${d.requiredLoggedDays || 60} logged days)`
        : "";
      alert((d?.message || "Couldn't complete the redemption.") + progress);
      setRedeemTarget(null);
      return;
    }
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
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky z-40 px-5 pt-3 pb-3 border-b" style={{ top: 'var(--topbar-h)', background: 'var(--surface-0)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Locker Room</h1>
          <PageLabel number={5} />
        </div>

        {/* Points balance — nameplate treatment */}
        <div className="relative mb-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)', padding: '12px 14px 10px' }}>
          <span style={{ position: 'absolute', top: 6, left: 6, width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)' }} />
          <span style={{ position: 'absolute', top: 6, right: 6, width: 3, height: 3, borderRadius: '50%', background: 'var(--border-strong)' }} />
          <p className="eyebrow" style={{ textAlign: 'center' }}>Your Balance</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <Zap size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: "'Archivo Black', sans-serif", fontVariantNumeric: 'tabular-nums', fontSize: 'var(--text-xl)', color: 'var(--accent)' }}>{points.toLocaleString()}</span>
            <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>pts</span>
          </div>
        </div>

        {/* Progress to YOUR goal — only exists when the store is live and stocked.
            The bar is a reflection of the item shop, never a manual input. */}
        {STORE_LIVE && items.length > 0 && (() => {
          const sortedItems = [...items].sort((a, b) => a.points_required - b.points_required);
          const goalItem = sortedItems.find(i => i.id === goalItemId)
            || sortedItems.filter(i => i.type === "gift_card")[0]
            || sortedItems[0];
          return goalItem ? (
            <div className="mb-3">
              <button onClick={() => setShowGoalPicker(true)} className="w-full text-left" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <PointsBar current={points} target={goalItem.points_required} label={`Your Goal: ${goalItem.name} — tap to change`} />
              </button>
              {points < goalItem.points_required ? (
                <p className="font-work text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {(goalItem.points_required - points).toLocaleString()} pts to go — about {Math.max(1, Math.ceil((goalItem.points_required - points) / 300)).toLocaleString()} max-effort days. Keep stacking.
                </p>
              ) : (
                <p className="font-work text-[10px] mt-1" style={{ color: 'var(--positive)' }}>
                  Goal hit — you've got the points for {goalItem.name}.
                </p>
              )}
            </div>
          ) : null;
        })()}

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
                color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">

        {/* STORE TAB — hidden until merch & rewards are ready to fulfill */}
        {tab === "store" && (
          <div className="text-center py-16">
            <Package size={40} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-4" />
            <h3 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>Store Coming Soon</h3>
            <p className="font-work text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
              We're building out real rewards worth stacking points for. Keep earning — your balance is safe and waiting.
            </p>
          </div>
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
                <Package size={40} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-4" />
                <h3 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>No Orders Yet</h3>
                <p className="font-work text-sm" style={{ color: 'var(--text-secondary)' }}>Keep earning and redeem your first reward.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {redemptions.map(r => (
                  <div key={r.id} className="rounded border p-4 flex items-center gap-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--theme-surface-alt)', border: '1px solid var(--theme-border)' }}>
                      {r.reward_type === "merch" ? <Shirt size={16} style={{ color: 'var(--accent)' }} /> : <Gift size={16} style={{ color: 'var(--accent)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{r.reward_name}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{r.points_spent.toLocaleString()} pts spent</p>
                    </div>
                    <span className="font-elite text-[9px] uppercase px-2 py-0.5 rounded"
                      style={{
                        background: r.status === "delivered" ? 'var(--theme-ink)' : 'var(--theme-surface-alt)',
                        color: r.status === "delivered" ? 'var(--surface-0)' : 'var(--accent)',
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
              <p className="font-work text-xs mb-4" style={{ color: 'var(--theme-ink-soft)' }}>Consistent daily effort adds up. A $5 gift card takes ~4 months of consistent daily effort.</p>
              <div className="space-y-3">
                {DAILY_BREAKDOWN.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--theme-border)' }}>
                    <p className="font-work text-xs flex-1" style={{ color: 'var(--theme-ink)' }}>{d.action}</p>
                    <div className="flex items-center gap-1 ml-3">
                      <Zap size={10} style={{ color: 'var(--accent)' }} />
                      <span className="font-elite text-sm" style={{ color: 'var(--accent)' }}>+{d.pts}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <p className="font-work text-xs font-semibold" style={{ color: 'var(--theme-ink)' }}>Daily Max (all 5 tasks)</p>
                  <div className="flex items-center gap-1">
                    <Zap size={10} style={{ color: 'var(--accent)' }} />
                    <span className="font-elite text-sm font-bold" style={{ color: 'var(--accent)' }}>85</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <h2 className="font-anton text-xl uppercase mb-3" style={{ color: 'var(--theme-ink)' }}>Challenge Tiers</h2>
              {[
                { tier: "Bronze", pts: "5", freq: "Daily", ex: "Complete any 1 daily task", color: '#9BA3AC' },
                { tier: "Silver", pts: "15", freq: "Daily", ex: "Complete 3 of 5 daily tasks", color: '#5E646B' },
                { tier: "Gold", pts: "50", freq: "Daily", ex: "Complete all 5 daily tasks", color: 'var(--accent)' },
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
                    <Zap size={10} style={{ color: 'var(--accent)' }} />
                    <span className="font-elite text-sm" style={{ color: 'var(--accent)' }}>{t.pts}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <h2 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--theme-ink)' }}>Referral Bonus</h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: 'var(--theme-ink)' }}>Friend joins via your link</p>
                  <span className="font-elite text-sm" style={{ color: 'var(--accent)' }}>+500 pts</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="font-work text-xs" style={{ color: 'var(--text-primary)' }}>Friend logs 3 workouts</p>
                  <span className="font-elite text-sm" style={{ color: 'var(--accent)' }}>+1,500 pts</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {redeemTarget && (
        <RedeemModal item={redeemTarget} onClose={() => setRedeemTarget(null)} onConfirm={onRedeemed} />
      )}

      {/* Goal picker sheet — live shop items only, pick which one the bar chases */}
      {STORE_LIVE && showGoalPicker && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowGoalPicker(false)}>
          <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[70vh] overflow-y-auto p-5"
            style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-anton text-lg uppercase" style={{ color: 'var(--text-primary)' }}>Pick Your Goal</h2>
              <button onClick={() => setShowGoalPicker(false)} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="space-y-2">
              {[...items].sort((a, b) => a.points_required - b.points_required).map(item => (
                <button key={item.id}
                  onClick={() => { setGoalItemId(item.id); localStorage.setItem("pb_reward_goal", item.id); setShowGoalPicker(false); }}
                  className="w-full flex items-center justify-between rounded border p-3 text-left"
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: goalItemId === item.id ? 'var(--accent)' : 'var(--border-subtle)',
                  }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{item.type === "merch" ? "Merch" : "Gift Card"}</p>
                  </div>
                  <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                    <Zap size={11} style={{ color: 'var(--accent)' }} />
                    <span className="tabular-nums text-sm font-semibold" style={{ color: 'var(--accent)' }}>{item.points_required.toLocaleString()}</span>
                  </div>
                </button>
              ))}
              {items.length === 0 && (
                <p className="font-work text-sm text-center py-8" style={{ color: 'var(--text-secondary)' }}>Rewards are being stocked — check back soon.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}