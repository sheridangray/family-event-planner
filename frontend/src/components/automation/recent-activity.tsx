"use client";

import { format } from "date-fns";

export function RecentActivity() {
  const activities = [
    {
      id: '1',
      type: 'discovery',
      message: 'Discovered 3 new art events at Community Art Center',
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
      status: 'success',
      rule: 'Art events discovery',
    },
    {
      id: '2',
      type: 'approval',
      message: 'Auto-approved "Story Time Adventures" at SF Library',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'success',
      rule: 'Auto-approve free SF Library events',
    },
    {
      id: '3',
      type: 'registration',
      message: 'Successfully registered for "Family Paint Night"',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      status: 'success',
      rule: 'Auto-register for Cal Academy events under $25',
    },
    {
      id: '4',
      type: 'failure',
      message: 'Failed to register for "Science Workshop" - event full',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      status: 'error',
      rule: 'Auto-register for Cal Academy events under $25',
    },
    {
      id: '5',
      type: 'approval',
      message: 'Auto-approved "Toddler Music Time" with high priority',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      status: 'success',
      rule: 'Weekend art events priority',
    },
  ];

  const getActivityIcon = (type: string, status: string) => {
    if (status === 'error') return '❌';
    
    switch (type) {
      case 'discovery': return '🔍';
      case 'approval': return '✅';
      case 'registration': return '🎯';
      case 'failure': return '⚠️';
      default: return '📝';
    }
  };

  const getActivityColor = (type: string, status: string) => {
    if (status === 'error') return 'text-red-600 bg-red-50 border-red-200';
    
    switch (type) {
      case 'discovery': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'approval': return 'text-green-600 bg-green-50 border-green-200';
      case 'registration': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'failure': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">📋 Recent Activity</h3>
          <button className="text-sm text-indigo-600 hover:text-indigo-800">
            View All Logs →
          </button>
        </div>

        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className={`border rounded-lg p-4 ${getActivityColor(activity.type, activity.status)}`}>
              <div className="flex items-start">
                <div className="text-lg mr-3 mt-0.5">
                  {getActivityIcon(activity.type, activity.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {activity.message}
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-gray-600">
                        <span>Rule: {activity.rule}</span>
                        <span>•</span>
                        <span>{format(activity.timestamp, 'h:mm a')}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {format(activity.timestamp, 'MMM d')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm font-medium text-gray-900">Success Rate</div>
              <div className="text-lg font-bold text-green-600">87%</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Avg Response</div>
              <div className="text-lg font-bold text-blue-600">2.3s</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Last 24h</div>
              <div className="text-lg font-bold text-indigo-600">23 actions</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}