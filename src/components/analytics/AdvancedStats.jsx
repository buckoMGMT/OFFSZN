// Advanced stat breakdowns — All-SZN Pass feature (Lane 2, platform-owned).
import PremiumGate from "@/components/ui/PremiumGate";
import ReadinessIndex from "@/components/analytics/ReadinessIndex";
import PercentileCard from "@/components/analytics/PercentileCard";
import ProjectedPeak from "@/components/analytics/ProjectedPeak";
import PositionLeaderboard from "@/components/analytics/PositionLeaderboard";

export default function AdvancedStats({ athlete, isPremium, onUpgrade }) {
  if (!isPremium) {
    return (
      <PremiumGate
        title="Advanced Stats"
        subtitle="Readiness index, percentile benchmarks, projected peak forecasting, and position leaderboards open with the All-SZN Pass."
        onUpgrade={onUpgrade}
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="eyebrow mt-1">Advanced Stats — All-SZN</p>
      <ReadinessIndex athlete={athlete} />
      <PercentileCard athlete={athlete} />
      <ProjectedPeak athlete={athlete} />
      <PositionLeaderboard athlete={athlete} />
    </div>
  );
}