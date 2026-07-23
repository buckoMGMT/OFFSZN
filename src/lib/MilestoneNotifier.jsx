import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Trophy, Zap, Flame, Star } from 'lucide-react';
import { hapticSuccess } from '@/lib/native';

const NotifierContext = createContext();

// Milestones checked against athlete.total_points
const POINT_MILESTONES = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 90];

function getMilestoneMessage(type, value) {
  if (type === 'points') {
    if (value >= 10000) return { title: 'LEGEND STATUS', body: `${value.toLocaleString()} points earned. You're elite.`, icon: Trophy, semantic: 'accent' };
    if (value >= 5000) return { title: 'POWER PLAY', body: `${value.toLocaleString()} points — halfway to your first reward!`, icon: Zap, semantic: 'accent' };
    return { title: 'MILESTONE HIT', body: `${value.toLocaleString()} points in the bank. Keep stacking.`, icon: Trophy, semantic: 'accent' };
  }
  if (type === 'streak') {
    if (value >= 30) return { title: `${value}-DAY WARRIOR`, body: `${value} days straight. Iron discipline.`, icon: Flame, semantic: 'warning' };
    if (value >= 7) return { title: 'WEEK STREAK', body: `${value} days in a row! You're on fire.`, icon: Flame, semantic: 'warning' };
    return { title: `${value}-DAY STREAK`, body: `${value} days consistent — don't break the chain!`, icon: Flame, semantic: 'warning' };
  }
  return { title: 'ACHIEVEMENT', body: value, icon: Star, semantic: 'accent' };
}

const SEMANTIC_TOKENS = {
  accent:   { border: 'var(--accent)',        iconBg: 'var(--accent)',  iconFg: 'var(--on-accent)', title: 'var(--accent)' },
  positive: { border: 'var(--positive)',      iconBg: 'var(--positive)', iconFg: 'var(--surface-0)', title: 'var(--positive)' },
  warning:  { border: 'var(--warning)',        iconBg: 'var(--warning)',  iconFg: 'var(--surface-0)', title: 'var(--warning)' },
};

function NotificationBanner({ notification, onDismiss }) {
  const { title, body, icon: Icon, semantic = 'accent' } = notification;
  const tone = SEMANTIC_TOKENS[semantic] || SEMANTIC_TOKENS.accent;
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
        top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
        left: '50%',
        transform: `translateX(-50%) translateY(${exiting ? '-120%' : '0'})`,
        transition: 'transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)',
        opacity: exiting ? 0 : 1,
        zIndex: 9999,
        width: 'min(340px, 92vw)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        background: 'color-mix(in srgb, var(--surface-1) 88%, transparent)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: `1px solid ${tone.border}`,
        borderRadius: 'var(--r-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)', flexShrink: 0,
          background: tone.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={tone.iconFg} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-xs)', color: tone.title, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.2 }}>
            {title}
          </p>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.4 }}>
            {body}
          </p>
        </div>
        <button style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
      </div>
    </div>
  );
}

export function MilestoneNotifierProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const shownRef = useRef(new Set(JSON.parse(localStorage.getItem('pb_shown_milestones') || '[]')));

  const addNotification = useCallback((type, value) => {
    if (navigator.webdriver) return; // no toasts in automated/screenshot sessions
    const key = `${type}_${value}`;
    if (shownRef.current.has(key)) return;
    shownRef.current.add(key);
    localStorage.setItem('pb_shown_milestones', JSON.stringify([...shownRef.current]));

    const notification = { id: Date.now() + Math.random(), ...getMilestoneMessage(type, value) };
    setQueue(q => [...q, notification]);
    hapticSuccess(); // native success tap on every milestone (streak, points, PR)

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