// Pricing FAQ — canonical three-lane answers. Copy is compliance-reviewed; edit with care.
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
{
  q: "What does the All-SZN Pass include?",
  a: "Everything free athletes get, plus: post your own content to The Field, the full OFFSZN premium drill library, advanced stats (Readiness index, percentile benchmarks, Projected Peak forecasting, position leaderboards), the ability to create your own Team, eligibility to apply for verified Coach status, and no Promoted content in your feed. Coach programs are priced by each coach and sold separately."
},
{
  q: "Why do coach programs cost extra?",
  a: "Coaches on OFFSZN are verified professionals who set their own prices, and they keep the large majority of every sale. The Pass unlocks the platform; the marketplace pays the coaches who've perfected it."
},
{
  q: "Do I need the Pass to buy a coach's program?",
  a: "No. Anyone can buy coach content. Under-18 athletes need a verified guardian's approval."
}];


export default function PricingFAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div className="space-y-2">
      {FAQS.map((f, i) =>
      <div key={i} className="card-base overflow-hidden">
          <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-2 p-3 text-left">
            <span className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.q}</span>
            <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </button>
          {open === i &&
        <p className="px-3 pb-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.a}</p>
        }
        </div>
      )}
    </div>);

}