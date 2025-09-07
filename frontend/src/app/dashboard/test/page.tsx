import { DashboardHeader } from "@/components/dashboard/header";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { ActionCenter } from "@/components/dashboard/action-center";
import { QuickActions } from "@/components/dashboard/quick-actions";

// Mock user for testing UI without auth
const mockUser = {
  name: "Sheridan Gray",
  email: "sheridan.gray@gmail.com",
  image: null,
};

export default function DashboardTestPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded-lg">
        <p className="text-yellow-800 text-sm">
          🧪 <strong>Test Mode:</strong> This is the dashboard UI without authentication. 
          Visit <a href="/" className="underline">localhost:3002</a> for full auth flow.
        </p>
      </div>

      {/* Header */}
      <DashboardHeader user={mockUser} />

      {/* Quick Stats */}
      <QuickStats />

      {/* Upcoming Events Preview */}
      <UpcomingEvents />

      {/* Action Center */}
      <ActionCenter />

      {/* Quick Actions */}
      <QuickActions />
    </div>
  );
}