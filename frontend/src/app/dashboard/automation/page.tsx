import { AutomationHeader } from "@/components/automation/automation-header";

// Note: This page shows Discovery & Email Approval workflow, not auto-approval
import { LatestDiscoveryRun } from "@/components/automation/latest-discovery-run";
import { ScrapersManagement } from "@/components/automation/scrapers-management";
import { RecentActivity } from "@/components/automation/recent-activity";
import { SystemHealth } from "@/components/automation/system-health";
import { Suspense } from "react";

export default function AutomationPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <AutomationHeader />
      {/* Top Section - Latest Discovery Run & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-48"></div>}>
            <LatestDiscoveryRun />
          </Suspense>
        </div>
        <div>
          <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-48"></div>}>
            <SystemHealth />
          </Suspense>
        </div>
      </div>

      {/* Middle Section - Scrapers Management */}
      <div className="mb-6">
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
          <ScrapersManagement />
        </Suspense>
      </div>

      {/* Bottom Section - Recent Activity */}
      <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-64"></div>}>
        <RecentActivity />
      </Suspense>
    </div>
  );
}