import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Trophy, Zap, Flame, Star } from 'lucide-react';

const NotifierContext = createContext();

// Milestones checked against athlete.total_points
const POINT_MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90];

function getMilestoneMessage(type, value) {
  if (type === 'points') {
    if (value >= 10000) return { title: '🏆 LEGEND STATUS', body: `${value.toLocaleString()} points earned. You're elite.`, icon: Trophy, color: '#D7263D' };
    if (value >= 5000) return { title: '⚡ POWER PLAY', body: `${value.toLocaleString()} points — halfway to your first reward!`, icon: Zap, color: '#D7263D' };
    return { title: '🎯 MILESTONE HIT', body: `${value.toLocaleString()} points in the bank. Keep stacking.`, icon: Trophy, color: '#D7263D' };
  }
  if (type === 'streak') {
    if (value >= 30) return { title: `🔥 ${value}-DAY WARRIOR`, body: `${value} days straight. Iron discipline.`, icon: Flame, color: '#D7263D' };
    if (value >= 7) return { title: `🔥 WEEK STREAK`, body: `${value} days in a row! You're on fire.`, icon: Flame, color: '#D7263D' };
    return { title: `🔥 ${value}-DAY STREAK`, body: `${value} days consistent — don't break the chain!`, icon: Flame, color: '#D7263D' };
  }
  return { title: '⭐ ACHIEVEMENT', body: value, icon: Star, color: '#D7263D' };
}

function NotificationBanner({ notification, onDismiss }) {
  const { title, body, icon: Icon, color } = notification;
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    const t = setTimeout(dismiss, 4500);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        top: 60,
        left: '50%',
        transform: `translateX(-50%) translateY(${exiting ? '-120%' : '0'})`,
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease',
        opacity: exiting ? 0 : 1,
        zIndex: 9999,
        width: 'min(340px, 92vw)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        background: 'var(--theme-surface, #1B1B1D)',
        border: `2px solid ${color}`,
        borderRadius: 6,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        boxShadow: `0 4px 20px rgba(215,38,61,0.25)`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 4, flexShrink: 0,
          background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-2deg)',
        }}>
          <Icon size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Anton', sans-serif", fontSize: 13, color: color, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1.2 }}>
            {title}
          </p>
          <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, color: 'var(--theme-ink-soft, #9BA3AC)', marginTop: 3, lineHeight: 1.4 }}>
            {body}
          </p>
        </div>
        <button style={{ color: 'var(--theme-ink-soft, #9BA3AC)', fontSize: 16, lineHeight: 1, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
      </div>
    </div>
  );
}

export function MilestoneNotifierProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const shownRef = useRef(new Set(JSON.parse(localStorage.getItem('pb_shown_milestones') || '[]')));

  const addNotification = useCallback((type, value) => {
    const key = `${type}_${value}`;
    if (shownRef.current.has(key)) return;
    shownRef.current.add(key);
    localStorage.setItem('pb_shown_milestones', JSON.stringify([...shownRef.current]));

    const notification = { id: Date.now() + Math.random(), ...getMilestoneMessage(type, value) };
    setQueue(q => [...q, notification]);

    // Try browser notification too (bonus, non-blocking)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(notification.title, { body: notification.body, icon: '/favicon.ico' });
    }
  }, []);

  const checkMilestones = useCallback((athlete) => {
    if (!athlete) return;
    const pts = athlete.total_points || 0;
    const streak = athlete.current_streak_days || 0;

    POINT_MILESTONES.forEach(m => { if (pts >= m) addNotification('points', m); });
    STREAK_MILESTONES.forEach(m => { if (streak >= m) addNotification('streak', m); });
  }, [addNotification]);

  const dismiss = useCallback((id) => {
    setQueue(q => q.filter(n => n.id !== id));
  }, []);

  // Request browser notification permission on mount (non-blocking)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  return (
    <NotifierContext.Provider value={{ checkMilestones, addNotification }}>
      {children}
      {queue[0] && (
        <NotificationBanner
          key={queue[0].id}
          notification={queue[0]}
          onDismiss={() => dismiss(queue[0].id)}
        />
      )}
    </NotifierContext.Provider>
  );
}

export const useMilestoneNotifier = () => useContext(NotifierContext);