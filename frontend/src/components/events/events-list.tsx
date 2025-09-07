"use client";

import { useState } from "react";
import { EventCard } from "./event-card";
import { EventDetailModal } from "./event-detail-modal";
import { addDays, addWeeks } from "date-fns";

// Mock event data - will be replaced with real API calls
const mockEvents = [
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
    ageRange: { min: 3, max: 8 },
    status: "pending" as const,
    description: "Join us for an exciting hands-on art workshop designed for families! Kids will explore creativity through interactive painting while enjoying delicious pizza.",
    registrationUrl: "https://example.com/register/paint-pizza",
    imageUrl: null,
    socialProof: {
      rating: 4.8,
      reviewCount: 23,
      tags: ["Popular!", "Hands-on"],
    },
    context: {
      weather: "Perfect weather for walk there",
      preferences: "Similar to 'Art Class' you loved",
      urgency: null,
    },
    source: "Community Events",
    autoRegistration: "ready",
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
    ageRange: { min: 2, max: 6 },
    status: "approved" as const,
    description: "Discover the wonders of space through interactive exhibits, planetarium shows, and hands-on experiments perfect for young scientists.",
    registrationUrl: "https://calacademy.org/register/science-saturdays",
    imageUrl: null,
    socialProof: {
      rating: 4.9,
      reviewCount: 156,
      tags: ["Educational", "Interactive"],
    },
    context: {
      weather: "Indoor event - rain expected",
      preferences: "Perfect age match",
      urgency: "Only 8 spots left!",
    },
    source: "Cal Academy",
    autoRegistration: "ready",
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
    ageRange: { min: 1, max: 5 },
    status: "registered" as const,
    description: "Interactive story time with songs, movement, and craft activities. Perfect for developing early literacy skills.",
    registrationUrl: "https://sfpl.org/events/story-time",
    imageUrl: null,
    socialProof: {
      rating: 4.7,
      reviewCount: 89,
      tags: ["Weekly", "Educational"],
    },
    context: {
      weather: null,
      preferences: "You attend these regularly",
      urgency: null,
    },
    source: "SF Library",
    autoRegistration: "completed",
    confirmationNumber: "LIB-2024-0156",
  },
  {
    id: "4",
    title: "Toddler Music & Movement",
    date: addDays(new Date(), 8),
    time: "9:30-10:30 AM",
    location: {
      name: "Recreation Center",
      address: "456 Oak St, San Francisco, CA", 
      distance: "15 mins drive",
    },
    cost: 15,
    ageRange: { min: 1, max: 3 },
    status: "rejected" as const,
    description: "Music and movement class designed for toddlers. Instruments, dancing, and sensory play activities.",
    registrationUrl: "https://sfrecpark.org/music-movement",
    imageUrl: null,
    socialProof: {
      rating: 4.5,
      reviewCount: 34,
      tags: ["Active", "Social"],
    },
    context: {
      weather: null,
      preferences: "Too early - you prefer 10 AM+",
      urgency: null,
    },
    source: "SF Rec Parks",
    autoRegistration: null,
    rejectionReason: "Too early (before 10 AM)",
  },
  {
    id: "5",
    title: "Family Cooking Workshop",
    date: addDays(new Date(), 12),
    time: "2:00-4:00 PM",
    location: {
      name: "Culinary Institute",
      address: "789 Mission St, San Francisco, CA",
      distance: "22 mins drive", 
    },
    cost: 75,
    ageRange: { min: 4, max: 10 },
    status: "manual_required" as const,
    description: "Learn to cook family-friendly meals together. All ingredients and equipment provided.",
    registrationUrl: "https://culinary.edu/family-workshop",
    imageUrl: null,
    socialProof: {
      rating: 4.6,
      reviewCount: 67,
      tags: ["Hands-on", "Take-home"],
    },
    context: {
      weather: null,
      preferences: "First cooking class - exciting!",
      urgency: "Registration closes in 3 days",
    },
    source: "Community Events",
    autoRegistration: "failed",
    failureReason: "Payment required - manual registration sent",
  },
];

interface EventsListProps {
  searchParams: {
    status?: string;
    search?: string;
    venue?: string;
    cost?: string;
    age?: string;
    page?: string;
  };
}

export function EventsList({ searchParams }: EventsListProps) {
  const [selectedEvent, setSelectedEvent] = useState<typeof mockEvents[0] | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  // Filter events based on search params
  const filteredEvents = mockEvents.filter(event => {
    if (searchParams.status && searchParams.status !== "all") {
      return event.status === searchParams.status;
    }
    return true;
  });

  const handleEventAction = (eventId: string, action: 'approve' | 'reject') => {
    // TODO: Implement API call to update event status
    console.log(`${action} event ${eventId}`);
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    // TODO: Implement bulk API call
    console.log(`${action} events:`, selectedEvents);
    setSelectedEvents([]);
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Bulk Actions Bar */}
      {selectedEvents.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-indigo-700 font-medium">
              {selectedEvents.length} events selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Reject All
              </button>
              <button
                onClick={() => setSelectedEvents([])}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {searchParams.status === "pending" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">💡 SUGGESTED ACTIONS</h3>
          <div className="space-y-2">
            <button className="flex items-center text-sm text-blue-700 hover:text-blue-900">
              <span className="mr-2">🎨</span>
              Approve all 3 art events this weekend
            </button>
            <button className="flex items-center text-sm text-blue-700 hover:text-blue-900">
              <span className="mr-2">💰</span>
              Approve all 5 free events next week
            </button>
          </div>
        </div>
      )}

      {/* Events Grid */}
      <div className="space-y-4">
        {filteredEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isSelected={selectedEvents.includes(event.id)}
            onSelect={() => toggleEventSelection(event.id)}
            onViewDetails={() => setSelectedEvent(event)}
            onApprove={() => handleEventAction(event.id, 'approve')}
            onReject={() => handleEventAction(event.id, 'reject')}
          />
        ))}
      </div>

      {/* Load More */}
      {filteredEvents.length > 0 && (
        <div className="text-center mt-6">
          <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Load More Events
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredEvents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-600 mb-4">
            No events match your current filters.
          </p>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Clear Filters
          </button>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onApprove={() => {
            handleEventAction(selectedEvent.id, 'approve');
            setSelectedEvent(null);
          }}
          onReject={() => {
            handleEventAction(selectedEvent.id, 'reject');
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}