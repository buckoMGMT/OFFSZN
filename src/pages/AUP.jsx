// Acceptable Use — plain language, athlete voice. Linked from Help and signup.
import { Link } from "react-router-dom";

const RULES = [
  ["Respect the locker room", "No harassment, hate, bullying, or threats. Trash talk your rival's 40 time, not the person."],
  ["Keep it clean", "No sexual content, anywhere, ever. Most athletes here are 13–17."],
  ["Be who you say you are", "No impersonating athletes, coaches, or schools. Fake coaches get banned and reported."],
  ["Don't game the points", "No bots, multi-accounts, or fake logs to farm the Locker Room. The fraud system watches, and it's good."],
  ["13 and up, period", "Under 13? Not yet — but soon. Come back when you're eligible."],
  ["Coaches: stay professional with minors", "All messaging is logged and moderated. No off-platform contact with minor athletes. That line ends accounts."],
];

export default function AUP() {
  return (
    <div className="min-h-screen px-5 pt-12 pb-24" style={{ background: "var(--surface-0)", maxWidth: 560, margin: "0 auto" }}>
      <span className="eyebrow" style={{ color: "var(--accent)" }}>The rules of the field</span>
      <h1 className="font-display text-2xl text-tx-primary mt-2 mb-6">ACCEPTABLE USE.</h1>

      <div className="space-y-4 mb-8">
        {RULES.map(([title, body]) => (
          <div key={title} className="card-base p-4">
            <p className="font-semibold text-sm text-tx-primary mb-1">{title}</p>
            <p className="text-sm text-tx-secondary">{body}</p>
          </div>
        ))}
      </div>

      <div className="card-base p-4 mb-4">
        <p className="font-semibold text-sm text-tx-primary mb-1">What happens if you break these</p>
        <p className="text-sm text-tx-secondary">
          First it's removal of the content. Then suspension. Then a ban. Safety issues involving minors skip straight to the end of that list.
        </p>
      </div>

      <div className="card-base p-4 mb-8">
        <p className="font-semibold text-sm text-tx-primary mb-1">See something? Say something.</p>
        <p className="text-sm text-tx-secondary">
          Report any post, drill, or profile from its ⋯ menu. We review every report.
        </p>
      </div>

      <Link to="/" className="text-sm font-medium" style={{ color: "var(--accent)" }}>← Back to the field</Link>
    </div>
  );
}