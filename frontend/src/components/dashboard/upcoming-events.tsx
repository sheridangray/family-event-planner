"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { api, Event, ApiError } from "@/lib/api";

export function UpcomingEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        setLoading(true);
        const dashboardData = await api.getDashboard();
        setEvents(dashboardData.upcomingEvents);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch upcoming events:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingEvents();
  }, []);

  if (loading) {
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm animate-pulse">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="bg-gray-300 h-4 w-32 mb-2 rounded"></div>
                  <div className="bg-gray-300 h-5 w-48 rounded"></div>
                </div>
                <div className="bg-gray-300 h-6 w-16 rounded-full"></div>
              </div>
              <div className="flex items-center space-x-4 mt-3">
                <div className="bg-gray-300 h-3 w-20 rounded"></div>
                <div className="bg-gray-300 h-3 w-12 rounded"></div>
                <div className="bg-gray-300 h-3 w-16 rounded"></div>
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
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-center">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

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

      {events.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-8 rounded-lg text-center">
          <div className="text-4xl mb-2">📅</div>
          <p className="text-gray-600">No upcoming events this week</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {format(new Date(event.date), "EEEE, MMM d")}
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
                <span>{event.cost === "0.00" || event.cost === "0" ? 'FREE' : `$${event.cost}`}</span>
                <span>•</span>
                <span>{event.context?.weather || 'Weather info unavailable'}</span>
              </div>

              {event.status === 'manual_required' && (
                <div className="mt-2 text-sm text-orange-600">
                  ⚠️ Registration auto-failed - Manual link sent
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}