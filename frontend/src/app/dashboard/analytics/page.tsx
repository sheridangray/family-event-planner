import { AnalyticsHeader } from "@/components/analytics/analytics-header";
import { DiscoveryMetrics } from "@/components/analytics/discovery-metrics";
import { FamilyInsights } from "@/components/analytics/family-insights";
import { EventTrends } from "@/components/analytics/event-trends";
import { CostAnalysis } from "@/components/analytics/cost-analysis";
import { VenuePopularity } from "@/components/analytics/venue-popularity";
import { Suspense } from "react";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AnalyticsHeader />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Top Row - Key Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-64"></div>}>
            <DiscoveryMetrics />
          </Suspense>
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-64"></div>}>
            <FamilyInsights />
          </Suspense>
        </div>

        {/* Middle Row - Trends */}
        <div className="mb-6">
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
            <EventTrends />
          </Suspense>
        </div>

        {/* Bottom Row - Detailed Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-80"></div>}>
            <CostAnalysis />
          </Suspense>
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-80"></div>}>
            <VenuePopularity />
          </Suspense>
        </div>
      </div>
    </div>
  );
}