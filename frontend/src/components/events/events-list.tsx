"use client";

import { useState, useEffect } from "react";
import { EventCard } from "./event-card";
import { EventDetailModal } from "./event-detail-modal";
import { api, Event, ApiError } from "@/lib/api";

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
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string[]>([]);

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await api.getEvents(searchParams);
        setEvents(response.events);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [searchParams]);

  const handleEventAction = async (eventId: string, action: 'approve' | 'reject') => {
    try {
      setActionLoading(prev => [...prev, eventId]);
      
      if (action === 'approve') {
        await api.approveEvent(eventId);
      } else {
        await api.rejectEvent(eventId);
      }
      
      // Update the event status locally
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { ...event, status: action === 'approve' ? 'approved' : 'rejected' }
          : event
      ));
      
      // Remove from selected if it was selected
      setSelectedEvents(prev => prev.filter(id => id !== eventId));
    } catch (err) {
      console.error(`Failed to ${action} event:`, err);
      alert(`Failed to ${action} event: ${err instanceof ApiError ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    try {
      setActionLoading(selectedEvents);
      
      // Process all selected events in parallel
      const promises = selectedEvents.map(eventId => 
        action === 'approve' ? api.approveEvent(eventId) : api.rejectEvent(eventId)
      );
      
      await Promise.all(promises);
      
      // Update events status locally
      setEvents(prev => prev.map(event => 
        selectedEvents.includes(event.id)
          ? { ...event, status: action === 'approve' ? 'approved' : 'rejected' }
          : event
      ));
      
      setSelectedEvents([]);
    } catch (err) {
      console.error(`Failed to ${action} events:`, err);
      alert(`Failed to ${action} events: ${err instanceof ApiError ? err.message : 'Unknown error'}`);
    } finally {
      setActionLoading([]);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="bg-gray-300 h-6 w-3/4 mb-2 rounded"></div>
                  <div className="bg-gray-300 h-4 w-1/2 rounded"></div>
                </div>
                <div className="bg-gray-300 h-8 w-20 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="bg-gray-300 h-4 w-full rounded"></div>
                <div className="bg-gray-300 h-4 w-2/3 rounded"></div>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="bg-gray-300 h-4 w-1/4 rounded"></div>
                <div className="flex space-x-2">
                  <div className="bg-gray-300 h-8 w-20 rounded"></div>
                  <div className="bg-gray-300 h-8 w-20 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-center">
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
                disabled={actionLoading.length > 0}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading.length > 0 ? 'Processing...' : 'Approve All'}
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                disabled={actionLoading.length > 0}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading.length > 0 ? 'Processing...' : 'Reject All'}
              </button>
              <button
                onClick={() => setSelectedEvents([])}
                disabled={actionLoading.length > 0}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {searchParams.status === "pending" && events.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">💡 SUGGESTED ACTIONS</h3>
          <div className="space-y-2">
            <button className="flex items-center text-sm text-blue-700 hover:text-blue-900">
              <span className="mr-2">🎨</span>
              Approve all art events this weekend
            </button>
            <button className="flex items-center text-sm text-blue-700 hover:text-blue-900">
              <span className="mr-2">💰</span>
              Approve all free events next week
            </button>
          </div>
        </div>
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
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
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
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
      )}

      {/* Load More */}
      {events.length > 0 && (
        <div className="text-center mt-6">
          <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Load More Events
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