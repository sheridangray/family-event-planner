import { auth } from "@/auth";
import { DashboardHeader } from "@/components/dashboard/header";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { ActionCenter } from "@/components/dashboard/action-center";
import { QuickActions } from "@/components/dashboard/quick-actions";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // This shouldn't happen due to layout protection, but good to have
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <DashboardHeader user={session.user} />

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