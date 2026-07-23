import { useState } from "react";
import { X, Shirt, Gift, MapPin } from "lucide-react";
import StampButton from "@/components/ui/StampButton";

export default function RedeemModal({ item, onClose, onConfirm }) {
  const [address, setAddress] = useState("");
  const [confirming, setConfirming] = useState(false);

  const needsAddress = item.type === "merch";

  const handleConfirm = async () => {
    if (needsAddress && !address.trim()) return;
    setConfirming(true);
    await onConfirm(item, address);
    setConfirming(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="glass-sheet w-full max-w-lg rounded-t-2xl p-6 animate-slide-up"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-2xl)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Confirm Redemption</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="rounded-lg border p-4 mb-4 flex items-center gap-4" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)' }}>
            {item.type === "merch" ? <Shirt size={20} style={{ color: 'var(--accent)' }} /> : <Gift size={20} style={{ color: 'var(--accent)' }} />}
          </div>
          <div>
            <p className="font-work font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
            <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{item.points_required.toLocaleString()} points</p>
          </div>
        </div>

        {needsAddress && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={12} style={{ color: 'var(--accent)' }} />
              <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Shipping Address</span>
            </div>
            <textarea
              className="input-base w-full resize-none h-20"
              placeholder="Full name, street address, city, state, zip..."
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
        )}

        {!needsAddress && (
          <p className="font-work text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Your gift card code will be sent to your registered email within 3–5 business days after review.
          </p>
        )}

        <div className="rounded-lg border p-3 mb-5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <p className="font-elite text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>Note</p>
          <p className="font-work text-xs" style={{ color: 'var(--text-secondary)' }}>
            Redemptions are manually reviewed within 3–5 business days. All sales are final.
          </p>
        </div>

        <div className="flex justify-center">
          <StampButton
            onClick={handleConfirm}
            disabled={confirming || (needsAddress && !address.trim())}
            className="text-base px-10 py-3"
          >
            {confirming ? "Processing…" : `Redeem — ${item.points_required.toLocaleString()} pts`}
          </StampButton>
        </div>
      </div>
    </div>
  );
}