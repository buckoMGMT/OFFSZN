// Subs tab — coaches the athlete subscribes to, with their latest drops.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BadgeCheck, BellRing, Play } from "lucide-react";
import useSubscriptions from "@/lib/useSubscriptions";
import CoachProfileSheet from "@/components/playbook/CoachProfileSheet";
import CoachPurchaseSheet from "@/components/monetization/CoachPurchaseSheet";
import ExploreVideoSheet from "@/components/playbook/ExploreVideoSheet";

export default function SubscriptionsTab({ athlete }) {
  const { subscribedIds, toggle } = useSubscriptions(athlete);
  const [coaches, setCoaches] = useState([]);
  const [videos, setVideos] = useState([]);
  const [profileCoach, setProfileCoach] = useState(null);
  const [buying, setBuying] = useState(null);
  const [watching, setWatching] = useState(null);
  const [purchasedIds, setPurchasedIds] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Athlete.list("-created_date", 100),
      base44.entities.UserVideoSubmission.filter({ status: "approved" }, "-created_date", 50),
    ]).then(([athletes, vids]) => {
      setCoaches(athletes);
      setVideos(vids);
    });
  }, []);

  const subscribedCoaches = coaches.filter(c => subscribedIds.includes(c.id));

  const playOrBuy = (v) => {
    if (v.price_usd > 0 && !purchasedIds.includes(v.id)) setBuying(v);
    else setWatching(v);
  };

  if (subscribedCoaches.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <BellRing size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
        <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No subscriptions yet</p>
        <p className="font-work text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Subscribe to a coach from their profile in Explore and you'll get notified when they drop new content.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {subscribedCoaches.map(coach => {
          const coachVideos = videos.filter(v => v.athlete_id === coach.id);
          return (
            <div key={coach.id} className="card-base p-4">
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setProfileCoach(coach)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <img src={coach.avatar_url} alt={coach.display_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid var(--accent)' }} />
                  <div className="min-w-0">
                    <span className="flex items-center gap-1 font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {coach.display_name}
                      {coach.is_coach_verified && <BadgeCheck size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                    </span>
                    <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{coachVideos.length} drills</p>
                  </div>
                </button>
                <button onClick={() => toggle(coach)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-elite text-[9px] uppercase tracking-widest flex-shrink-0"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                  <BellRing size={10} style={{ color: 'var(--accent)' }} /> Subscribed
                </button>
              </div>
              <div className="space-y-1.5">
                {coachVideos.slice(0, 2).map(v => (
                  <button key={v.id} onClick={() => playOrBuy(v)} className="card-tappable w-full p-2.5 flex items-center gap-2.5 text-left" style={{ background: 'var(--surface-2)' }}>
                    <Play size={12} fill="currentColor" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <p className="flex-1 min-w-0 font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                    {v.price_usd > 0 && !purchasedIds.includes(v.id) && (
                      <span className="tabular-nums text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                        ${v.price_usd.toFixed(2)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
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
        item={buying ? { title: buying.title, price: `$${buying.price_usd?.toFixed(2)}`, coachName: coaches.find(c => c.id === buying.athlete_id)?.display_name || "Coach" } : null}
        onBuy={() => { setPurchasedIds(prev => [...prev, buying.id]); setWatching(buying); setBuying(null); }}
      />
      <ExploreVideoSheet
        open={!!watching}
        onClose={() => setWatching(null)}
        video={watching}
        author={watching ? coaches.find(c => c.id === watching.athlete_id) : null}
      />
    </>
  );
}