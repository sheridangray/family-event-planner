"use client";

export function ActionCenter() {
  // Mock data - will be replaced with real API calls
  const activities = [
    {
      id: "1",
      type: "success",
      message: 'Auto-registered for "Toddler Music Class" ✅',
      time: "2 hours ago",
      detail: "Confirmation #ABC123",
    },
    {
      id: "2", 
      type: "manual",
      message: 'Manual registration sent for "Cooking Workshop" 📧',
      time: "4 hours ago",
      detail: "Payment required ($45)",
    },
    {
      id: "3",
      type: "rejected",
      message: "Rejected 3 events: Too expensive, Wrong age range",
      time: "6 hours ago",
      detail: null,
    },
    {
      id: "4",
      type: "discovery",
      message: "System discovered 12 new events 🔍", 
      time: "This morning",
      detail: "5 require your approval",
    },
  ];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🔄 RECENT ACTIVITY
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {activities.map((activity) => (
          <div key={activity.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-900 mb-1">
                  {activity.message}
                </p>
                {activity.detail && (
                  <p className="text-xs text-gray-600 mb-1">
                    {activity.detail}
                  </p>
                )}
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
              
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ml-3 ${
                activity.type === 'success' ? 'bg-green-400' :
                activity.type === 'manual' ? 'bg-orange-400' :
                activity.type === 'rejected' ? 'bg-red-400' :
                'bg-blue-400'
              }`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}