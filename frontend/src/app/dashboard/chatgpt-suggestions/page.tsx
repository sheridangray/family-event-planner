"use client";

import { useState, useEffect } from "react";
import { DiscoveryList } from "@/components/chatgpt/discovery-list";
import { DiscoveryDetail } from "@/components/chatgpt/discovery-detail";
import { SparklesIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface Discovery {
  id: number;
  date_searched: string;
  target_date: string;
  search_context: any;
  events: any[];
  metadata: any;
  interested_event_ranks: number[];
  created_at: string;
}

export default function ChatGPTSuggestionsPage() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [selectedDiscovery, setSelectedDiscovery] = useState<Discovery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiscoveries = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/chatgpt-event-discoveries?limit=20&offset=0');
      
      if (!response.ok) {
        throw new Error('Failed to fetch discoveries');
      }

      const data = await response.json();
      
      if (data.success) {
        setDiscoveries(data.discoveries);
        
        // Auto-select the most recent discovery
        if (data.discoveries.length > 0 && !selectedDiscovery) {
          setSelectedDiscovery(data.discoveries[0]);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch discoveries');
      }
    } catch (err) {
      console.error('Error fetching discoveries:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiscoveries();
  }, []);

  const handleSelectDiscovery = (id: number) => {
    const discovery = discoveries.find(d => d.id === id);
    if (discovery) {
      setSelectedDiscovery(discovery);
    }
  };

  const handleMarkInterested = async (eventRank: number) => {
    if (!selectedDiscovery) return;

    try {
      const response = await fetch(
        `/api/chatgpt-event-discoveries/${selectedDiscovery.id}/mark-interested`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ eventRank }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update interested status');
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        setSelectedDiscovery(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            interested_event_ranks: data.interestedRanks
          };
        });

        // Update discoveries list
        setDiscoveries(prev =>
          prev.map(d =>
            d.id === selectedDiscovery.id
              ? { ...d, interested_event_ranks: data.interestedRanks }
              : d
          )
        );
      }
    } catch (err) {
      console.error('Error marking event as interested:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Discoveries</h3>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchDiscoveries}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <SparklesIcon className="h-8 w-8 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                ChatGPT Daily Event Suggestions
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                AI-curated family events powered by ChatGPT
              </p>
            </div>
          </div>
          
          <button
            onClick={fetchDiscoveries}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Discovery List */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Past Discoveries
            </h2>
            <DiscoveryList
              discoveries={discoveries}
              selectedId={selectedDiscovery?.id || null}
              onSelect={handleSelectDiscovery}
            />
          </div>
        </div>

        {/* Main Content - Discovery Detail */}
        <div className="lg:col-span-3">
          {selectedDiscovery ? (
            <DiscoveryDetail
              discovery={selectedDiscovery}
              onMarkInterested={handleMarkInterested}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <SparklesIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a Discovery
              </h3>
              <p className="text-gray-600">
                Choose a discovery from the list to view event details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

