"use client";

export function EventTrends() {
  // Mock data for the last 12 weeks
  const weeklyData = [
    { week: 'Week 1', discovered: 8, approved: 4, attended: 3 },
    { week: 'Week 2', discovered: 12, approved: 7, attended: 5 },
    { week: 'Week 3', discovered: 6, approved: 3, attended: 2 },
    { week: 'Week 4', discovered: 15, approved: 9, attended: 7 },
    { week: 'Week 5', discovered: 10, approved: 6, attended: 4 },
    { week: 'Week 6', discovered: 14, approved: 8, attended: 6 },
    { week: 'Week 7', discovered: 9, approved: 5, attended: 4 },
    { week: 'Week 8', discovered: 13, approved: 8, attended: 6 },
    { week: 'Week 9', discovered: 11, approved: 7, attended: 5 },
    { week: 'Week 10', discovered: 16, approved: 10, attended: 8 },
    { week: 'Week 11', discovered: 12, approved: 7, attended: 5 },
    { week: 'Week 12', discovered: 18, approved: 12, attended: 9 },
  ];

  const maxValue = Math.max(...weeklyData.map(d => Math.max(d.discovered, d.approved, d.attended)));

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">📈 Event Trends (Last 12 Weeks)</h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span className="text-gray-600">Discovered</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span className="text-gray-600">Approved</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded mr-2"></div>
              <span className="text-gray-600">Attended</span>
            </div>
          </div>
        </div>
        
        {/* Simple Bar Chart */}
        <div className="relative h-64">
          <div className="flex items-end justify-between h-full space-x-1">
            {weeklyData.map((data, index) => {
              const discoveredHeight = (data.discovered / maxValue) * 100;
              const approvedHeight = (data.approved / maxValue) * 100;
              const attendedHeight = (data.attended / maxValue) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="flex items-end space-x-0.5 mb-2">
                    <div 
                      className="bg-blue-500 w-2 rounded-t"
                      style={{ height: `${discoveredHeight * 2}px` }}
                    ></div>
                    <div 
                      className="bg-green-500 w-2 rounded-t"
                      style={{ height: `${approvedHeight * 2}px` }}
                    ></div>
                    <div 
                      className="bg-purple-500 w-2 rounded-t"
                      style={{ height: `${attendedHeight * 2}px` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 text-center transform -rotate-45 origin-center mt-4">
                    W{index + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Weekly Average</div>
              <div className="text-lg font-semibold text-blue-600">12.1 discovered</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Best Week</div>
              <div className="text-lg font-semibold text-green-600">Week 12 (18)</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Growth Trend</div>
              <div className="text-lg font-semibold text-purple-600">+23% ↗️</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}