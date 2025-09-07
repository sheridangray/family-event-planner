"use client";

export function AutomationStatus() {
  const stats = {
    eventsDiscoveredToday: 8,
    autoApprovedToday: 3,
    autoRegisteredToday: 1,
    failedRegistrationsToday: 0,
    totalActiveRules: 5,
    nextDiscoveryRun: "15 minutes",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">📊 Today's Automation Activity</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.eventsDiscoveredToday}</div>
            <div className="text-sm text-gray-600">Events Discovered</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.autoApprovedToday}</div>
            <div className="text-sm text-gray-600">Auto-Approved</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.autoRegisteredToday}</div>
            <div className="text-sm text-gray-600">Auto-Registered</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.failedRegistrationsToday > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {stats.failedRegistrationsToday}
            </div>
            <div className="text-sm text-gray-600">Failed Attempts</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-600">{stats.totalActiveRules}</div>
            <div className="text-sm text-gray-600">Active Rules</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{stats.nextDiscoveryRun}</div>
            <div className="text-sm text-gray-600">Next Discovery</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm rounded-full hover:bg-indigo-200">
              🔍 Run Discovery Now
            </button>
            <button className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full hover:bg-green-200">
              ✅ Review Pending
            </button>
            <button className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200">
              ⚠️ Check Failures
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}