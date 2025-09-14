"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface ScraperRun {
  discovery_run_id: number;
  scraper_id: number;
  scraper_name: string;
  scraper_display_name: string;
  scraper_url: string;
  events_found: number;
  success: boolean;
  error_message: string | null;
  execution_time_ms: number;
  started_at: string;
  completed_at: string;
}

interface DiscoveryRun {
  discoveryRunId: number;
  startedAt: string;
  completedAt: string;
  totalEventsFound: number;
  scraperRuns: ScraperRun[];
}

interface DiscoveredEvent {
  id: string;
  title: string;
  date: string;
  cost: number;
  source: string;
  filterResults: {
    passed: boolean;
    reasons: string[];
  };
  emailStatus: string;
  total_score?: number;
}

export function RecentActivity() {
  const [discoveryRuns, setDiscoveryRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());
  const [expandedScrapers, setExpandedScrapers] = useState<Set<string>>(new Set());
  const [scraperEvents, setScraperEvents] = useState<Record<string, DiscoveredEvent[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDiscoveryRuns = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/automation/scraper-runs?limit=5');
        if (!response.ok) {
          throw new Error('Failed to fetch scraper runs');
        }
        const data = await response.json();
        setDiscoveryRuns(data);
      } catch (error) {
        console.error('Error fetching scraper runs:', error);
        setError('Failed to load recent activity');
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryRuns();
    // Refresh every 2 minutes
    const interval = setInterval(fetchDiscoveryRuns, 120000);

    return () => clearInterval(interval);
  }, []);

  const toggleDiscoveryRun = (runId: number) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const toggleScraperEvents = async (runId: number, scraperName: string) => {
    const scraperKey = `${runId}-${scraperName}`;
    const newExpandedScrapers = new Set(expandedScrapers);
    
    if (newExpandedScrapers.has(scraperKey)) {
      newExpandedScrapers.delete(scraperKey);
    } else {
      newExpandedScrapers.add(scraperKey);
      
      // Load events for this scraper run if not already loaded
      if (!scraperEvents[scraperKey] && !loadingEvents.has(scraperKey)) {
        setLoadingEvents(prev => new Set(prev).add(scraperKey));
        
        try {
          const response = await fetch(`http://localhost:3000/api/automation/discovery-run/${runId}/events`);
          if (response.ok) {
            const events = await response.json();
            // Filter events by scraper (based on source)
            const scraperSpecificEvents = events.filter((event: DiscoveredEvent) => 
              event.source === scraperName
            );
            setScraperEvents(prev => ({
              ...prev,
              [scraperKey]: scraperSpecificEvents
            }));
          }
        } catch (error) {
          console.error(`Failed to load events for ${scraperKey}:`, error);
        } finally {
          setLoadingEvents(prev => {
            const newSet = new Set(prev);
            newSet.delete(scraperKey);
            return newSet;
          });
        }
      }
    }
    
    setExpandedScrapers(newExpandedScrapers);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  const formatExecutionTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `Ran for ${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else {
      return `Ran for ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
  };

  const getRunStatusIcon = (scraperRuns: ScraperRun[]) => {
    const failedCount = scraperRuns.filter(run => !run.success).length;
    if (failedCount === 0) return '✅';
    if (failedCount === scraperRuns.length) return '❌';
    return '⚠️';
  };

  const getScraperStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌';
  };

  const getFilterStatusIcon = (filterResults: { passed: boolean; reasons: string[] }) => {
    return filterResults.passed ? '✅' : '❌';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">📋 Recent Discovery Runs</h3>
          <div className="text-xs text-gray-500">
            Click to expand details
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="mt-2 h-3 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {discoveryRuns.map((discoveryRun) => (
              <div key={discoveryRun.discoveryRunId} className="border rounded-lg">
                {/* Discovery Run Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleDiscoveryRun(discoveryRun.discoveryRunId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {expandedRuns.has(discoveryRun.discoveryRunId) ? 
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" /> : 
                        <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                      }
                      <div className="text-lg">{getRunStatusIcon(discoveryRun.scraperRuns)}</div>
                      <div>
                        <div className="font-medium text-gray-900">
                          Discovery Run #{discoveryRun.discoveryRunId}
                        </div>
                        <div className="text-xs text-gray-600">
                          {discoveryRun.scraperRuns.length} scraper{discoveryRun.scraperRuns.length !== 1 ? 's' : ''} • {discoveryRun.totalEventsFound} event{discoveryRun.totalEventsFound !== 1 ? 's' : ''} found
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      <div>{formatTimeAgo(discoveryRun.completedAt || discoveryRun.startedAt)}</div>
                      <div>{format(new Date(discoveryRun.completedAt || discoveryRun.startedAt), 'MMM d, h:mm a')}</div>
                    </div>
                  </div>
                </div>

                {/* Expanded Discovery Run Details */}
                {expandedRuns.has(discoveryRun.discoveryRunId) && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-4 space-y-3">
                      {discoveryRun.scraperRuns.map((scraperRun) => {
                        const scraperKey = `${discoveryRun.discoveryRunId}-${scraperRun.scraper_name}`;
                        const isExpanded = expandedScrapers.has(scraperKey);
                        const events = scraperEvents[scraperKey] || [];
                        const isLoadingEvents = loadingEvents.has(scraperKey);

                        return (
                          <div key={scraperKey} className="bg-white border rounded-md">
                            {/* Scraper Run Header */}
                            <div 
                              className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleScraperEvents(discoveryRun.discoveryRunId, scraperRun.scraper_name)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {isExpanded ? 
                                    <ChevronDownIcon className="h-3 w-3 text-gray-400" /> : 
                                    <ChevronRightIcon className="h-3 w-3 text-gray-400" />
                                  }
                                  <div className="text-sm">{getScraperStatusIcon(scraperRun.success)}</div>
                                  <div>
                                    <div className="text-sm font-medium">
                                      {scraperRun.scraper_url ? (
                                        <a 
                                          href={scraperRun.scraper_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 hover:underline"
                                          title={`Open ${scraperRun.scraper_display_name} scrape page`}
                                        >
                                          {scraperRun.scraper_display_name}
                                          <span className="ml-1 text-xs">🔗</span>
                                        </a>
                                      ) : (
                                        <span className="text-gray-900">{scraperRun.scraper_display_name}</span>
                                      )}
                                    </div>
                                    {scraperRun.success ? (
                                      <div className="text-xs text-gray-600">
                                        {scraperRun.events_found} events found • {formatExecutionTime(scraperRun.execution_time_ms)}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-red-600">
                                        Error: {scraperRun.error_message}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatTimeAgo(scraperRun.completed_at)}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Scraper Events */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 bg-gray-25">
                                <div className="p-3">
                                  {isLoadingEvents ? (
                                    <div className="text-xs text-gray-500 text-center py-2">
                                      Loading discovered events...
                                    </div>
                                  ) : events.length === 0 ? (
                                    <div className="text-xs text-gray-500 text-center py-2">
                                      No events saved (likely all duplicates)
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {events.map((event) => (
                                        <div key={event.id} className="bg-white border border-gray-100 rounded p-2">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs">
                                                  {getFilterStatusIcon(event.filterResults)}
                                                </span>
                                                <span className="text-xs font-medium text-gray-900 truncate">
                                                  {event.title}
                                                </span>
                                              </div>
                                              <div className="text-xs text-gray-600 mb-1">
                                                {format(new Date(event.date), 'MMM d, h:mm a')} • 
                                                {event.cost > 0 ? ` $${event.cost}` : ' Free'}
                                                {event.total_score && ` • Score: ${event.total_score.toFixed(1)}`}
                                              </div>
                                              <div className="text-xs">
                                                {event.filterResults.passed ? (
                                                  <span className="text-green-600">
                                                    ✅ {event.filterResults.reasons[0]} • {event.emailStatus}
                                                  </span>
                                                ) : (
                                                  <span className="text-red-600">
                                                    ❌ {event.filterResults.reasons.join(", ")}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && !error && discoveryRuns.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>No discovery runs found</p>
            <p className="text-xs">Discovery runs will appear here as scrapers find new events</p>
          </div>
        )}
      </div>
    </div>
  );
}