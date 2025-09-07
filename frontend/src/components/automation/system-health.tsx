"use client";

export function SystemHealth() {
  const healthMetrics = {
    overallHealth: 98,
    discoveryEngine: { status: 'healthy', uptime: '99.8%', lastRun: '5 min ago' },
    registrationBot: { status: 'healthy', uptime: '99.5%', lastRun: '2 hrs ago' },
    emailNotifications: { status: 'healthy', uptime: '100%', lastSent: '1 hr ago' },
    apiConnections: { status: 'warning', uptime: '95.2%', issue: '1 source timeout' },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏥 System Health</h3>
        
        {/* Overall Health Score */}
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-green-600 mb-1">
            {healthMetrics.overallHealth}%
          </div>
          <div className="text-sm text-gray-600">Overall System Health</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-green-500 h-2 rounded-full" 
              style={{ width: `${healthMetrics.overallHealth}%` }}
            ></div>
          </div>
        </div>

        {/* Component Health */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="mr-2">{getStatusIcon(healthMetrics.discoveryEngine.status)}</span>
              <span className="font-medium">Discovery Engine</span>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                getStatusColor(healthMetrics.discoveryEngine.status)
              }`}>
                {healthMetrics.discoveryEngine.status}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {healthMetrics.discoveryEngine.lastRun}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="mr-2">{getStatusIcon(healthMetrics.registrationBot.status)}</span>
              <span className="font-medium">Registration Bot</span>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                getStatusColor(healthMetrics.registrationBot.status)
              }`}>
                {healthMetrics.registrationBot.status}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {healthMetrics.registrationBot.lastRun}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="mr-2">{getStatusIcon(healthMetrics.emailNotifications.status)}</span>
              <span className="font-medium">Email Service</span>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                getStatusColor(healthMetrics.emailNotifications.status)
              }`}>
                {healthMetrics.emailNotifications.status}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {healthMetrics.emailNotifications.lastSent}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="mr-2">{getStatusIcon(healthMetrics.apiConnections.status)}</span>
              <span className="font-medium">API Connections</span>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                getStatusColor(healthMetrics.apiConnections.status)
              }`}>
                {healthMetrics.apiConnections.status}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {healthMetrics.apiConnections.issue}
              </div>
            </div>
          </div>
        </div>

        {/* System Actions */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button className="w-full px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View Detailed Logs →
          </button>
        </div>
      </div>
    </div>
  );
}