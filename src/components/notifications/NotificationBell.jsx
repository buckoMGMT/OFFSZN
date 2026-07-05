// Bell button with unread badge — opens the notification center and marks all read.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import NotificationsSheet from "@/components/notifications/NotificationsSheet";

export default function NotificationBell({ athlete }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!athlete?.id) return;
    base44.entities.Notification.filter({ recipient_athlete_id: athlete.id }, "-created_date", 30).then(setNotifications);
  }, [athlete?.id]);

  const unread = notifications.filter(n => !n.is_read).length;

  const handleOpen = async () => {
    setOpen(true);
    if (unread > 0) {
      await base44.entities.Notification.updateMany(
        { recipient_athlete_id: athlete.id, is_read: false },
        { $set: { is_read: true } }
      );
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <>
      <button onClick={handleOpen} className="relative p-2 rounded-full" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
        <Bell size={15} style={{ color: 'var(--text-secondary)' }} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center tabular-nums text-[9px] font-semibold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <NotificationsSheet open={open} onClose={handleClose} notifications={notifications} />
    </>
  );
}