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
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up"
        style={{ background: '#EDEEF0', borderColor: '#9BA3AC' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-anton text-2xl uppercase" style={{ color: '#15151A' }}>Confirm Redemption</h2>
          <button onClick={onClose} className="p-2 rounded" style={{ background: '#DCDEE1', border: '1px solid #9BA3AC' }}>
            <X size={16} style={{ color: '#5A5D63' }} />
          </button>
        </div>

        <div className="rounded border p-4 mb-4 flex items-center gap-4" style={{ background: '#DCDEE1', borderColor: '#9BA3AC' }}>
          <div className="w-12 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#EDEEF0', border: '1px solid #9BA3AC' }}>
            {item.type === "merch" ? <Shirt size={20} style={{ color: '#D7263D' }} /> : <Gift size={20} style={{ color: '#D7263D' }} />}
          </div>
          <div>
            <p className="font-work font-semibold" style={{ color: '#15151A' }}>{item.name}</p>
            <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: '#5A5D63' }}>{item.points_required.toLocaleString()} points</p>
          </div>
        </div>

        {needsAddress && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={12} style={{ color: '#D7263D' }} />
              <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: '#15151A' }}>Shipping Address</span>
            </div>
            <textarea
              className="w-full rounded px-4 py-3 text-sm font-work outline-none resize-none h-20"
              style={{ background: '#DCDEE1', border: '1px solid #9BA3AC', color: '#15151A' }}
              placeholder="Full name, street address, city, state, zip..."
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>
        )}

        {!needsAddress && (
          <p className="font-work text-xs mb-4" style={{ color: '#5A5D63' }}>
            Your gift card code will be sent to your registered email within 3–5 business days after review.
          </p>
        )}

        <div className="rounded border p-3 mb-5" style={{ background: '#DCDEE1', borderColor: '#9BA3AC44' }}>
          <p className="font-elite text-[9px] uppercase tracking-widest mb-1" style={{ color: '#5A5D63' }}>Note</p>
          <p className="font-work text-xs" style={{ color: '#5A5D63' }}>
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