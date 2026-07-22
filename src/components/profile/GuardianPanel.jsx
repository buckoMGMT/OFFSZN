// Guardian Center — shows only when the logged-in user is the guardian on at
// least one GuardianLink. Grants/revokes public-exposure approval for their
// minor (leaderboards, discoverable recruiting). All writes go through the
// guardianConsent function — the minor can never flip this themselves.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function GuardianPanel() {
  const [links, setLinks] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    base44.functions.invoke("guardianConsent", { action: "list" })
      .then(r => setLinks(r.data?.links || []))
      .catch(() => setLinks([]));
  }, []);

  const toggle = async (link) => {
    setBusyId(link.link_id);
    try {
      const res = await base44.functions.invoke("guardianConsent", {
        action: "set_public_exposure",
        linkId: link.link_id,
        approved: !link.public_exposure_approved,
      });
      setLinks(prev => prev.map(l => l.link_id === link.link_id
        ? { ...l, public_exposure_approved: !!res.data?.public_exposure_approved }
        : l));
    } catch {
      // leave state unchanged on failure
    } finally {
      setBusyId(null);
    }
  };

  // Render nothing for non-guardians — no empty section noise.
  if (!links || links.length === 0) return null;

  return (
    <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
      <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Guardian Center</p>
      {links.map(link => (
        <div key={link.link_id} className="px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <ShieldCheck size={15} style={{ color: link.status === 'verified' ? 'var(--positive)' : 'var(--text-tertiary)', flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{link.minor_name || "Linked athlete"}</p>
                <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>
                  {link.status === 'verified' ? "Public leaderboards & recruiting" : "Link pending verification"}
                </p>
              </div>
            </div>
            {link.status === 'verified' && (
              busyId === link.link_id ? (
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
              ) : (
                <button onClick={() => toggle(link)}
                  className="w-12 h-6 rounded-full relative transition-all duration-300 flex-shrink-0"
                  style={{ background: link.public_exposure_approved ? 'var(--accent)' : 'var(--surface-3)' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300"
                    style={{ left: link.public_exposure_approved ? '26px' : '2px' }} />
                </button>
              )
            )}
          </div>
          <p className="font-work text-[10px] leading-relaxed mt-1.5" style={{ color: 'var(--theme-ink-soft)' }}>
            Off means your athlete stays hidden from public boards — points and progress still count everywhere else.
          </p>
        </div>
      ))}
    </div>
  );
}