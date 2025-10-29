"use client";

import { useState } from "react";
import { EventCard } from "./event-card";
import { 
  MapIcon, 
  FunnelIcon,
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "@heroicons/react/24/outline";

interface DiscoveryDetailProps {
  discovery: {
    id: number;
    date_searched: string;
    target_date: string;
    search_context: any;
    events: any[];
    metadata: any;
    interested_event_ranks: number[];
    created_at: string;
  };
  onMarkInterested: (eventRank: number) => Promise<void>;
}

export function DiscoveryDetail({ discovery, onMarkInterested }: DiscoveryDetailProps) {
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [interestedRanks, setInterestedRanks] = useState<number[]>(
    discovery.interested_event_ranks || []
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleInterest = async (eventRank: number) => {
    setIsUpdating(true);
    try {
      await onMarkInterested(eventRank);
      
      // Toggle locally
      setInterestedRanks(prev => {
        if (prev.includes(eventRank)) {
          return prev.filter(r => r !== eventRank);
        } else {
          return [...prev, eventRank];
        }
      });
    } catch (error) {
      console.error('Failed to toggle interest:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const topPicks = discovery.events.filter(e => e.rank <= 3);
  const otherEvents = discovery.events.filter(e => e.rank > 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              Events for {formatDate(discovery.target_date)}
            </h2>
            <p className="text-indigo-100">
              Discovered on {new Date(discovery.date_searched).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{discovery.events.length}</div>
            <div className="text-sm text-indigo-100">Events Found</div>
          </div>
        </div>

        {/* Search Context Summary */}
        <button
          onClick={() => setIsContextExpanded(!isContextExpanded)}
          className="flex items-center justify-between w-full bg-white/10 hover:bg-white/20 rounded-lg p-3 transition-colors"
        >
          <span className="font-medium">Search Context & Filters</span>
          {isContextExpanded ? (
            <ChevronUpIcon className="h-5 w-5" />
          ) : (
            <ChevronDownIcon className="h-5 w-5" />
          )}
        </button>

        {isContextExpanded && (
          <div className="mt-4 bg-white/10 rounded-lg p-4 space-y-3">
            {/* Location */}
            <div className="flex items-start space-x-2">
              <MapIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Location</div>
                <div className="text-sm text-indigo-100">
                  {discovery.search_context.baseLocation} (within {discovery.search_context.searchRadiusMiles} miles)
                </div>
              </div>
            </div>

            {/* Family Context */}
            {discovery.search_context.familyContext && (
              <div className="flex items-start space-x-2">
                <UsersIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Family</div>
                  <div className="text-sm text-indigo-100">
                    {discovery.search_context.familyContext.children?.map((child: any) => child.name).join(', ')}
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            {discovery.search_context.filters && (
              <div className="flex items-start space-x-2">
                <FunnelIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Filters Applied</div>
                  <div className="text-sm text-indigo-100 space-y-1">
                    {discovery.search_context.filters.kidCentricAgeRange && (
                      <div>• Ages: {discovery.search_context.filters.kidCentricAgeRange}</div>
                    )}
                    {discovery.search_context.filters.strollerFriendly && (
                      <div>• Stroller-friendly</div>
                    )}
                    {discovery.search_context.filters.weekdayAfter5pm && (
                      <div>• Weekdays after 5 PM</div>
                    )}
                    {discovery.search_context.filters.considerWeather && (
                      <div>• Weather considered</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top 3 Picks */}
      {topPicks.length > 0 && (
        <div>
          <div className="flex items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">⭐ Top Picks</h3>
            <span className="ml-3 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
              Best Matches
            </span>
          </div>
          <div className="space-y-4">
            {topPicks.map((event) => (
              <EventCard
                key={event.rank}
                event={event}
                isInterested={interestedRanks.includes(event.rank)}
                onToggleInterest={() => handleToggleInterest(event.rank)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Events */}
      {otherEvents.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Other Recommendations ({otherEvents.length})
          </h3>
          <div className="space-y-4">
            {otherEvents.map((event) => (
              <EventCard
                key={event.rank}
                event={event}
                isInterested={interestedRanks.includes(event.rank)}
                onToggleInterest={() => handleToggleInterest(event.rank)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {discovery.metadata && (
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <div className="font-medium text-gray-900 mb-2">Generation Info</div>
          <div className="space-y-1">
            {discovery.metadata.generatedBy && (
              <div>Generated by: {discovery.metadata.generatedBy}</div>
            )}
            {discovery.metadata.version && (
              <div>Version: {discovery.metadata.version}</div>
            )}
            {discovery.metadata.runtimeSeconds && (
              <div>Runtime: {discovery.metadata.runtimeSeconds}s</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

