// Shared hook: which coaches the athlete subscribes to + toggle with coach notification.
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

export default function useSubscriptions(athlete) {
  const [subs, setSubs] = useState([]);

  useEffect(() => {
    if (!athlete?.id) return;
    base44.entities.CoachSubscription.filter({ subscriber_athlete_id: athlete.id }).then(setSubs);
  }, [athlete?.id]);

  const subscribedIds = subs.map(s => s.coach_athlete_id);

  const toggle = useCallback(async (coach) => {
    if (!athlete?.id || !coach?.id) return;
    const existing = subs.find(s => s.coach_athlete_id === coach.id);
    if (existing) {
      await base44.entities.CoachSubscription.delete(existing.id);
      setSubs(prev => prev.filter(s => s.id !== existing.id));
    } else {
      const sub = await base44.entities.CoachSubscription.create({
        subscriber_athlete_id: athlete.id,
        coach_athlete_id: coach.id,
      });
      setSubs(prev => [...prev, sub]);
      // Notify the coach about their new subscriber
      await base44.entities.Notification.create({
        recipient_athlete_id: coach.id,
        type: "new_subscriber",
        title: "New Subscriber",
        body: `${athlete.display_name} subscribed to your account.`,
        actor_name: athlete.display_name,
        actor_avatar: athlete.avatar_url,
      });
    }
  }, [subs, athlete]);

  return { subs, subscribedIds, toggle };
}