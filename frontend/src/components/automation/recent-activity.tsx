"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  status: string;
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const data = await api.getAutomationActivity();
        setActivities(data);
      } catch (error) {
        console.error('Error fetching activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Recent Activity</h3>
      
      {activities.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📭</div>
          <p>No recent activity</p>
          <p className="text-xs">Activity will appear here as events are discovered</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex-1">
                <div className="text-sm text-gray-900">{activity.message}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {activity.type === 'approval' && '✅ '}
                  {activity.type === 'discovery' && '🔍 '}
                  {activity.type === 'error' && '❌ '}
                  {formatTimeAgo(activity.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
