"use client";

import Link from "next/link";
import { format, addDays } from "date-fns";

export function UpcomingEvents() {
  // Mock data - will be replaced with real API calls
  const events = [
    {
      id: "1",
      title: "Family Art Workshop at SFMOMA",
      date: addDays(new Date(), 1),
      time: "2:00 PM - 4:00 PM",
      location: "SFMOMA",
      cost: "FREE",
      weather: "☀️ Sunny",
      status: "registered",
    },
    {
      id: "2", 
      title: "Science Saturdays at Cal Academy",
      date: addDays(new Date(), 2),
      time: "10:00 AM - 12:00 PM", 
      location: "Cal Academy",
      cost: "$25",
      weather: "⛅ Partly Cloudy",
      status: "manual_required",
    },
    {
      id: "3",
      title: "Story Time at Main Library",
      date: addDays(new Date(), 3),
      time: "11:00 AM - 12:00 PM",
      location: "Main Library", 
      cost: "FREE",
      weather: "🌧️ Rain Expected",
      status: "registered",
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          📅 THIS WEEK'S REGISTERED EVENTS
        </h2>
        <Link
          href="/dashboard/calendar"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          View All
        </Link>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {format(event.date, "EEEE, MMM d")}
                </p>
                <h3 className="text-base font-semibold text-gray-900">
                  {event.title}
                </h3>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                event.status === 'registered' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {event.status === 'registered' ? '✅' : '📧 Manual'}
              </span>
            </div>

            <div className="flex items-center text-sm text-gray-600 space-x-4">
              <span>{event.time}</span>
              <span>•</span>
              <span>{event.cost}</span>
              <span>•</span>
              <span>{event.weather}</span>
            </div>

            {event.status === 'manual_required' && (
              <div className="mt-2 text-sm text-orange-600">
                ⚠️ Registration auto-failed - Manual link sent
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}