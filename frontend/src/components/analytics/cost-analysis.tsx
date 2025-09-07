"use client";

export function CostAnalysis() {
  const costData = {
    totalSpent: 428,
    totalSaved: 156,
    avgEventCost: 12,
    freeEventsAttended: 18,
    paidEventsAttended: 16,
    budgetUtilization: 68, // percentage of budget used
    monthlyBudget: 100,
  };

  const costBreakdown = [
    { category: 'Art Classes', amount: 125, events: 8, color: 'bg-blue-500' },
    { category: 'Science Programs', amount: 89, events: 5, color: 'bg-green-500' },
    { category: 'Music & Dance', amount: 76, events: 4, color: 'bg-purple-500' },
    { category: 'Sports', amount: 65, events: 3, color: 'bg-orange-500' },
    { category: 'Cooking Classes', amount: 73, events: 2, color: 'bg-red-500' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">💰 Cost Analysis</h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">${costData.totalSpent}</div>
            <div className="text-sm text-green-700">Total Invested</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">${costData.avgEventCost}</div>
            <div className="text-sm text-blue-700">Avg Per Event</div>
          </div>
        </div>

        {/* Budget Usage */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Budget Usage</span>
            <span className="text-sm text-gray-600">${costData.monthlyBudget * costData.budgetUtilization / 100} / ${costData.monthlyBudget}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-indigo-500 h-3 rounded-full" 
              style={{ width: `${costData.budgetUtilization}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">{costData.budgetUtilization}% utilized</div>
        </div>

        {/* Category Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Spending by Category</h4>
          <div className="space-y-3">
            {costBreakdown.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${category.color} rounded`}></div>
                  <span className="text-sm text-gray-700">{category.category}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">${category.amount}</div>
                  <div className="text-xs text-gray-500">{category.events} events</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Value Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200 bg-yellow-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-yellow-800">🏆 Great Value!</span>
            <span className="text-yellow-700">{costData.freeEventsAttended} free + {costData.paidEventsAttended} paid events</span>
          </div>
        </div>
      </div>
    </div>
  );
}