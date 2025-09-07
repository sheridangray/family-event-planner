"use client";

export function FamilyInsights() {
  const insights = [
    {
      icon: '🎨',
      title: 'Art Activities Are a Hit!',
      description: 'Emma shows 94% attendance rate for art events',
      trend: 'up',
      confidence: 'high'
    },
    {
      icon: '⏰',
      title: 'Weekend Morning Preference',
      description: 'Family attends 85% more weekend 10am events',
      trend: 'stable',
      confidence: 'high'
    },
    {
      icon: '📍',
      title: 'SF Library is Your Go-To',
      description: '67% of registered events are at SF Library locations',
      trend: 'up',
      confidence: 'medium'
    },
    {
      icon: '💰',
      title: 'Budget-Conscious Choices',
      description: 'Average event cost: $12 (well under $25 limit)',
      trend: 'down',
      confidence: 'high'
    }
  ];

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '➡️';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🧠 Family Insights</h3>
        
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div key={index} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900">{insight.title}</h4>
                    <div className="flex items-center space-x-1">
                      <span className={`text-sm ${getTrendColor(insight.trend)}`}>
                        {getTrendIcon(insight.trend)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        insight.confidence === 'high' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {insight.confidence} confidence
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View Detailed Analysis →
          </button>
        </div>
      </div>
    </div>
  );
}