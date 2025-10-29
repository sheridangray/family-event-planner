"use client";

import { ClockIcon, CalendarDaysIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface DiscoveryListProps {
  discoveries: Array<{
    id: number;
    date_searched: string;
    target_date: string;
    events: any[];
    interested_event_ranks: number[];
    created_at: string;
  }>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function DiscoveryList({ discoveries, selectedId, onSelect }: DiscoveryListProps) {
  if (discoveries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <SparklesIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Discoveries Yet</h3>
        <p className="text-gray-600">
          ChatGPT event discoveries will appear here once your scheduled action runs.
        </p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <div className="space-y-3">
      {discoveries.map((discovery) => {
        const isSelected = selectedId === discovery.id;
        const interestedCount = discovery.interested_event_ranks?.length || 0;

        return (
          <button
            key={discovery.id}
            onClick={() => onSelect(discovery.id)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <CalendarDaysIcon className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                <div className="font-semibold text-gray-900">
                  {formatDate(discovery.target_date)}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {discovery.events.length} events
              </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <ClockIcon className="h-4 w-4 flex-shrink-0" />
              <span>Searched {formatTime(discovery.date_searched)} on {formatDate(discovery.date_searched)}</span>
            </div>

            {interestedCount > 0 && (
              <div className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                ❤️ {interestedCount} interested
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

