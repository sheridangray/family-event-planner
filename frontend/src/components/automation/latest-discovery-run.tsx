"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { api } from "@/lib/api";

interface LatestDiscoveryRunData {
  hasData: boolean;
  message?: string;
  discoveryRun?: {
    id: number;
    triggerType: string;
    startedAt: string;
    completedAt: string | null;
    duration: string;
    scrapersCount: number;
    eventsFound: number;
    eventsSaved: number;
    eventsDuplicated: number;
    status: string;
    errorMessage: string | null;
  };
  eventsBreakdown?: {
    totalEvents: number;
    eventsPassedFilters: number;
    eventsFilteredOut: number;
  };
  approvalPipeline?: {
    eventsSentForApproval: number;
    eventsPendingApproval: number;
    eventsApproved: number;
  };
  scraperBreakdown?: Array<{
    scraperName: string;
    eventsFound: number;
    eventsSaved: number;
    success: boolean;
    errorMessage: string | null;
    executionTimeMs: number;
  }>;
}

export function LatestDiscoveryRun() {
  const [data, setData] = useState<LatestDiscoveryRunData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestDiscoveryRun = async () => {
      try {
        const response = await api.getLatestDiscoveryRun();
        setData(response);
      } catch (error) {
        console.error('Error fetching latest discovery run:', error);
        setError('Failed to load latest discovery run data');
      } finally {
        setLoading(false);
      }
    };

    fetchLatestDiscoveryRun();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLatestDiscoveryRun, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
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
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'running':
        return <ClockIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getTriggerTypeDisplay = (triggerType: string) => {
    switch (triggerType) {
      case 'scheduled':
        return '⏰ Scheduled';
      case 'manual':
        return '👤 Manual';
      case 'startup':
        return '🚀 Startup';
      default:
        return `📋 ${triggerType}`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">🔍 Latest Discovery Run</h3>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-sm underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.hasData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>{data?.message || 'No discovery runs found'}</p>
            <p className="text-xs">Discovery runs will appear here after the first scrape</p>
          </div>
        </div>
      </div>
    );
  }

  const { discoveryRun, eventsBreakdown, approvalPipeline, scraperBreakdown } = data;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">🔍 Latest Discovery Run</h3>
          <div className="flex items-center space-x-2">
            {getStatusIcon(discoveryRun!.status)}
            <span className="text-sm text-gray-600">
              {formatTimeAgo(discoveryRun!.startedAt)}
            </span>
          </div>
        </div>

        {/* Basic Run Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Trigger Type</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {getTriggerTypeDisplay(discoveryRun!.triggerType)}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Duration</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {discoveryRun!.duration}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scrapers</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">
              {discoveryRun!.scrapersCount} active
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</div>
            <div className="text-sm font-semibold text-gray-900 mt-1 capitalize">
              {discoveryRun!.status}
            </div>
          </div>
        </div>

        {/* Events Pipeline Breakdown */}
        <div className="space-y-6">
          {/* Events Found vs Filtered */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">📊 Events Discovery & Filtering</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-lg font-bold text-blue-700">{eventsBreakdown!.totalEvents}</div>
                <div className="text-xs text-blue-600">Total Events Found</div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-lg font-bold text-green-700">{eventsBreakdown!.eventsPassedFilters}</div>
                <div className="text-xs text-green-600">Passed Filters</div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-lg font-bold text-red-700">{eventsBreakdown!.eventsFilteredOut}</div>
                <div className="text-xs text-red-600">Filtered Out</div>
              </div>
            </div>
          </div>

          {/* Approval Pipeline */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">📧 Approval Pipeline</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-lg font-bold text-yellow-700">{approvalPipeline!.eventsSentForApproval}</div>
                <div className="text-xs text-yellow-600">Sent for Approval</div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-lg font-bold text-orange-700">{approvalPipeline!.eventsPendingApproval}</div>
                <div className="text-xs text-orange-600">Pending Approval</div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-lg font-bold text-green-700">{approvalPipeline!.eventsApproved}</div>
                <div className="text-xs text-green-600">Approved</div>
              </div>
            </div>
          </div>

          {/* Scraper Breakdown */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">🤖 Scraper Performance</h4>
            <div className="space-y-2">
              {scraperBreakdown!.map((scraper, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm">
                      {scraper.success ? '✅' : '❌'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{scraper.scraperName}</div>
                      {!scraper.success && scraper.errorMessage && (
                        <div className="text-xs text-red-600">{scraper.errorMessage}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700">
                      {scraper.eventsFound} found • {scraper.eventsSaved} saved
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatExecutionTime(scraper.executionTimeMs)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Messages */}
          {discoveryRun!.errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm font-medium text-red-700 mb-1">Discovery Run Error</div>
              <div className="text-sm text-red-600">{discoveryRun!.errorMessage}</div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Run Summary</div>
            <div className="text-sm text-gray-700">
              Started {format(new Date(discoveryRun!.startedAt), 'MMM d, h:mm a')} • 
              Run #{discoveryRun!.id} • 
              {discoveryRun!.eventsFound} events found • 
              {discoveryRun!.eventsSaved} saved • 
              {discoveryRun!.eventsDuplicated} duplicates
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}