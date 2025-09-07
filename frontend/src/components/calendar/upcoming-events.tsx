"use client";

import { useState } from "react";
import { format, addDays, addWeeks } from "date-fns";
import { 
  ClockIcon, 
  MapPinIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

// Mock upcoming events data
const upcomingEvents = [
  {
    id: "1",
    title: "Family Paint & Pizza Night",
    date: addDays(new Date(), 2),
    time: "6:00-8:00 PM",
    location: {
      name: "Community Art Center",
      address: "123 Main St, San Francisco, CA",
      distance: "12 mins drive",
    },
    cost: 25,
    status: "registered" as const,
    confirmationNumber: "ART-2024-0123",
    reminderSet: true,
  },
  {
    id: "2", 
    title: "Science Saturdays: Explore the Universe",
    date: addDays(new Date(), 5),
    time: "10:00 AM-12:00 PM", 
    location: {
      name: "California Academy of Sciences",
      address: "55 Music Concourse Dr, San Francisco, CA",
      distance: "18 mins drive",
    },
    cost: 0,
    status: "approved" as const,
    reminderSet: false,
    urgency: "Registration closes in 2 days",
  },
  {
    id: "3",
    title: "Story Time Adventures",
    date: addWeeks(new Date(), 1),
    time: "11:00 AM-12:00 PM",
    location: {
      name: "SF Public Library - Main Branch", 
      address: "100 Larkin St, San Francisco, CA",
      distance: "8 mins drive",
    },
    cost: 0,
    status: "registered" as const,
    confirmationNumber: "LIB-2024-0156",
    reminderSet: true,
    isRecurring: true,
  },
];

export function UpcomingEvents() {
  const [filter, setFilter] = useState<'all' | 'registered' | 'approved'>('all');

  const filteredEvents = upcomingEvents.filter(event => {
    if (filter === 'all') return true;
    return event.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            ✅ Approved
          </span>
        );
      case 'registered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            🎯 Registered
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">📋 Upcoming Events</h3>
          <span className="text-sm text-gray-500">{filteredEvents.length} events</span>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('registered')}
            className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'registered' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Registered
          </button>
          <button
            onClick={() => setFilter('approved')}
            className={`flex-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
              filter === 'approved' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Approved
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="divide-y divide-gray-200">
        {filteredEvents.map((event) => (
          <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
            {/* Event Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  {event.title}
                  {event.isRecurring && (
                    <span className="ml-2 text-xs text-gray-500">🔄</span>
                  )}
                </h4>
                <div className="flex items-center text-xs text-gray-600">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {format(event.date, 'EEE, MMM d')}
                  <ClockIcon className="h-3 w-3 ml-2 mr-1" />
                  {event.time}
                </div>
              </div>
              {getStatusBadge(event.status)}
            </div>

            {/* Event Details */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center text-xs text-gray-600">
                <MapPinIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                <span className="truncate">{event.location.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                  {event.cost === 0 ? 'FREE' : `$${event.cost}`}
                </div>
                <div className="text-gray-500">
                  🚗 {event.location.distance}
                </div>
              </div>
            </div>

            {/* Status-specific Information */}
            {event.status === 'registered' && event.confirmationNumber && (
              <div className="bg-green-50 border border-green-200 rounded p-2 mb-2">
                <div className="text-xs text-green-800">
                  🎫 Confirmation: <span className="font-medium">{event.confirmationNumber}</span>
                </div>
              </div>
            )}

            {event.urgency && (
              <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-2">
                <div className="flex items-center text-xs text-orange-800">
                  <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                  {event.urgency}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button className="flex items-center text-xs text-indigo-600 hover:text-indigo-800">
                <InformationCircleIcon className="h-3 w-3 mr-1" />
                Details
              </button>

              <div className="flex items-center space-x-2">
                {event.status === 'approved' && (
                  <button className="text-xs text-green-600 hover:text-green-800 font-medium">
                    Register
                  </button>
                )}
                
                <button className={`flex items-center text-xs font-medium ${
                  event.reminderSet 
                    ? 'text-green-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                  {event.reminderSet ? (
                    <>
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      Reminder set
                    </>
                  ) : (
                    <>
                      + Remind me
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="p-8 text-center">
          <div className="text-4xl mb-2">📅</div>
          <h4 className="text-sm font-medium text-gray-900 mb-1">No upcoming events</h4>
          <p className="text-xs text-gray-500">
            {filter === 'all' 
              ? 'No events scheduled for the coming weeks.' 
              : `No ${filter} events found.`}
          </p>
        </div>
      )}

      {/* Footer */}
      {filteredEvents.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View All Events →
          </button>
        </div>
      )}
    </div>
  );
}