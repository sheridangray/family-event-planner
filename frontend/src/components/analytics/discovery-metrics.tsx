"use client";

export function DiscoveryMetrics() {
  const metrics = {
    totalDiscovered: 156,
    approved: 89,
    registered: 34,
    attended: 28,
    approvalRate: 57,
    attendanceRate: 82,
    avgResponseTime: '2.3h',
    weeklyTrend: '+12%',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🔍 Event Discovery Metrics</h3>
        
        {/* Funnel Visualization */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Events Discovered</span>
              <span className="text-sm font-bold text-gray-900">{metrics.totalDiscovered}</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full w-full"></div>
            </div>
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Approved</span>
              <span className="text-sm font-bold text-gray-900">{metrics.approved} ({metrics.approvalRate}%)</span>
            </div>
            <div className="w-full bg-green-200 rounded-full h-3">
              <div className="bg-green-500 h-3 rounded-full" style={{width: `${metrics.approvalRate}%`}}></div>
            </div>
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Registered</span>
              <span className="text-sm font-bold text-gray-900">{metrics.registered}</span>
            </div>
            <div className="w-full bg-purple-200 rounded-full h-3">
              <div className="bg-purple-500 h-3 rounded-full" style={{width: '38%'}}></div>
            </div>
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Actually Attended</span>
              <span className="text-sm font-bold text-gray-900">{metrics.attended} ({metrics.attendanceRate}%)</span>
            </div>
            <div className="w-full bg-indigo-200 rounded-full h-3">
              <div className="bg-indigo-500 h-3 rounded-full" style={{width: '31%'}}></div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{metrics.avgResponseTime}</div>
            <div className="text-xs text-gray-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{metrics.weeklyTrend}</div>
            <div className="text-xs text-gray-600">Weekly Growth</div>
          </div>
        </div>
      </div>
    </div>
  );
}