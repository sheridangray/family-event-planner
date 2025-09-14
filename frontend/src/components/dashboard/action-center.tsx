"use client";

import { useEffect, useState } from "react";
import { api, Event, ApiError } from "@/lib/api";

interface Activity {
  id: string;
  type: "success" | "manual" | "rejected" | "discovery";
  message: string;
  time: string;
  detail: string | null;
}

export function ActionCenter() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        const dashboardData = await api.getDashboard();
        
        // For now, we'll create mock activities from the pending events
        // In the future, the backend should provide actual activity logs
        const mockActivities: Activity[] = dashboardData.pendingEvents.slice(0, 4).map((event, index) => ({
          id: event.id,
          type: event.status === 'approved' ? 'success' : event.status === 'rejected' ? 'rejected' : 'discovery',
          message: `Event discovered: "${event.title}"`,
          time: `${index + 1} hour${index === 0 ? '' : 's'} ago`,
          detail: (event.cost === "0.00" || event.cost === "0") ? 'FREE event' : `$${event.cost} per person`,
        }));
        
        setActivities(mockActivities);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch activity data:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load recent activity');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🔄 RECENT ACTIVITY
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="bg-gray-300 h-4 w-3/4 mb-2 rounded"></div>
                  <div className="bg-gray-300 h-3 w-1/2 mb-1 rounded"></div>
                  <div className="bg-gray-300 h-3 w-1/4 rounded"></div>
                </div>
                <div className="bg-gray-300 w-2 h-2 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          🔄 RECENT ACTIVITY
        </h2>
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-center">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🔄 RECENT ACTIVITY
      </h2>

      {activities.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-8 rounded-lg text-center">
          <div className="text-4xl mb-2">🔄</div>
          <p className="text-gray-600">No recent activity</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}