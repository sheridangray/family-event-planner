"use client";

export function VenuePopularity() {
  const venues = [
    {
      name: 'SF Public Library',
      events: 12,
      attendance: 11,
      rating: 4.8,
      categories: ['Educational', 'Reading'],
      color: 'bg-green-500'
    },
    {
      name: 'California Academy of Sciences',
      events: 8,
      attendance: 7,
      rating: 4.9,
      categories: ['Science', 'Interactive'],
      color: 'bg-blue-500'
    },
    {
      name: 'Community Art Center',
      events: 6,
      attendance: 5,
      rating: 4.7,
      categories: ['Art', 'Crafts'],
      color: 'bg-purple-500'
    },
    {
      name: 'SF Recreation Centers',
      events: 4,
      attendance: 3,
      rating: 4.5,
      categories: ['Sports', 'Active'],
      color: 'bg-orange-500'
    },
    {
      name: 'Music Schools',
      events: 4,
      attendance: 4,
      rating: 4.6,
      categories: ['Music', 'Performance'],
      color: 'bg-red-500'
    },
  ];

  const totalEvents = venues.reduce((sum, venue) => sum + venue.events, 0);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🏛️ Venue Popularity</h3>
        
        <div className="space-y-4">
          {venues.map((venue, index) => {
            const percentage = (venue.events / totalEvents) * 100;
            const attendanceRate = (venue.attendance / venue.events) * 100;
            
            return (
              <div key={index} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{venue.name}</h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <div className="flex space-x-1">
                        {venue.categories.map((category, idx) => (
                          <span key={idx} className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{venue.events} events</div>
                    <div className="text-xs text-yellow-600">★ {venue.rating}</div>
                  </div>
                </div>
                
                {/* Usage Bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Usage</span>
                    <span>{percentage.toFixed(0)}% of total</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`${venue.color} h-2 rounded-full`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Attendance Rate */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Attendance rate:</span>
                  <span className={`font-medium ${
                    attendanceRate >= 90 ? 'text-green-600' :
                    attendanceRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {attendanceRate.toFixed(0)}% ({venue.attendance}/{venue.events})
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-center text-sm">
            <div>
              <div className="font-medium text-gray-900">Top Venue</div>
              <div className="text-green-600">{venues[0].name}</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Best Rating</div>
              <div className="text-blue-600">★ {Math.max(...venues.map(v => v.rating))}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}