import { auth } from "@/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session?.user) {
    return null; // This shouldn't happen due to layout protection, but good to have
  }

  const firstName = session.user.name?.split(" ")[0] || "there";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {firstName}! 👋
        </h1>
        <p className="text-lg text-gray-600">
          Your family event discovery system is ready to help you find amazing activities for Apollo and Athena.
        </p>
      </div>

      {/* Event Discovery Card */}
      <Link 
        href="/dashboard/events" 
        className="block p-8 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">🎯 Event Discovery</h3>
            <p className="text-lg text-gray-600">
              Run discovery, manage scrapers, and review recent activity
            </p>
          </div>
          <div className="text-gray-400 text-2xl">→</div>
        </div>
      </Link>
    </div>
  );
}