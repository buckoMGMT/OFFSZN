// Owner-only nudge: if moderation items are waiting, show it on login.
// Access truth stays server-side (reviewQueue 403s non-admins); the role
// check here just avoids a pointless request for regular users.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ReviewAlertBanner() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== "admin") return;
      base44.functions.invoke("reviewQueue", { action: "load" })
        .then(r => setCount((r.data?.media?.length || 0) + (r.data?.reports?.length || 0)))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  if (!count) return null;
  return (
    <Link to="/review" className="flex items-center gap-2 mx-4 mt-2 px-3 py-2 rounded-lg border"
      style={{ background: 'var(--accent-subtle)', borderColor: 'var(--accent)' }}>
      <ShieldAlert size={14} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        You have {count} item{count === 1 ? "" : "s"} to review →
      </p>
    </Link>
  );
}