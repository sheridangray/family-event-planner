"use client";

import { useState, useEffect } from "react";

interface AutomationStats {
  eventsDiscoveredLatest: number;
  emailsSentLatest: number;
  emailApprovalsReceived: number;
  lastDiscoveryRun: string;
  filteredEventsLatest: number;
  emailNotificationStatus: string;
  nextDiscoveryRun: string;
  latestDiscoveryRunId: number;
}

interface DiscoveryProgress {
  running: boolean;
  discoveryRunId: number | null;
  totalScrapers: number;
  completedScrapers: number;
  currentScraper: {
    name: string;
    displayName: string;
    status: string;
    startedAt: string;
  } | null;
  scraperResults: Array<{
    name: string;
    displayName: string;
    success: boolean;
    eventsFound: number;
    executionTime: number;
    errorMessage: string | null;
  }>;
  startTime: string | null;
  progress: number;
}

export function AutomationStatus() {
  const [stats, setStats] = useState<AutomationStats>({
    eventsDiscoveredLatest: 0,
    emailsSentLatest: 0,
    emailApprovalsReceived: 0,
    lastDiscoveryRun: "Loading...",
    filteredEventsLatest: 0,
    emailNotificationStatus: "Loading...",
    nextDiscoveryRun: "Loading...",
    latestDiscoveryRunId: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const [discoveryProgress, setDiscoveryProgress] = useState<DiscoveryProgress | null>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/automation/status');
        if (!response.ok) {
          throw new Error('Failed to fetch automation status');
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching automation status:', error);
        setError('Failed to load automation status');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => {
      clearInterval(interval);
      // Cleanup progress interval on unmount
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [progressInterval]);

  const fetchDiscoveryProgress = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/automation/discovery-progress');
      if (response.ok) {
        const progress = await response.json();
        setDiscoveryProgress(progress);
        
        // If discovery finished, clear the progress
        if (!progress.running && progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
          setDiscoveryRunning(false);
          
          // Show completion message
          const totalEvents = progress.scraperResults.reduce((sum: number, result: any) => sum + result.eventsFound, 0);
          setDiscoveryMessage(`✅ Discovery completed! Found ${totalEvents} events from ${progress.completedScrapers} scrapers.`);
          
          // Refresh stats
          setTimeout(async () => {
            try {
              const statsResponse = await fetch('http://localhost:3000/api/automation/status');
              if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                setStats(statsData);
              }
            } catch (error) {
              console.error('Error refreshing stats:', error);
            }
          }, 1000);
          
          // Clear completion message after 8 seconds
          setTimeout(() => {
            setDiscoveryMessage(null);
          }, 8000);
        }
      }
    } catch (error) {
      console.error('Error fetching discovery progress:', error);
    }
  };

  const runDiscoveryNow = async () => {
    setDiscoveryRunning(true);
    setDiscoveryMessage(null);
    
    try {
      const response = await fetch('http://localhost:3000/api/automation/run-discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setDiscoveryMessage('🚀 Discovery started! Monitoring scraper progress...');
        setDiscoveryProgress(null); // Reset progress
        
        // Start polling for progress
        const interval = setInterval(fetchDiscoveryProgress, 1000);
        setProgressInterval(interval);
        
        // Initial progress fetch
        setTimeout(fetchDiscoveryProgress, 500);
      } else {
        throw new Error(data.error || 'Failed to start discovery');
      }
    } catch (error) {
      console.error('Error running discovery:', error);
      setDiscoveryMessage('❌ Failed to start discovery. Please try again.');
      setDiscoveryRunning(false);
      
      // Clear message after 10 seconds
      setTimeout(() => {
        setDiscoveryMessage(null);
      }, 10000);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
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
          <div className="text-center text-red-600">
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">📊 Latest Discovery Run #{stats.latestDiscoveryRunId}</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.eventsDiscoveredLatest}</div>
            <div className="text-sm text-gray-600">Events Discovered</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${stats.filteredEventsLatest > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {stats.filteredEventsLatest}
            </div>
            <div className="text-sm text-gray-600">Filtered Events</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.emailsSentLatest}</div>
            <div className="text-sm text-gray-600">Sent for Approval</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.emailApprovalsReceived}</div>
            <div className="text-sm text-gray-600">Approved via Email</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{stats.lastDiscoveryRun}</div>
            <div className="text-sm text-gray-600">Last Discovery</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{stats.nextDiscoveryRun}</div>
            <div className="text-sm text-gray-600">Next Discovery</div>
          </div>
          
          <div className="text-center">
            <div className={`text-lg font-bold ${stats.emailNotificationStatus === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
              {stats.emailNotificationStatus === 'active' ? '✓ Active' : '⚠ Disabled'}
            </div>
            <div className="text-sm text-gray-600">Email Status</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
          
          {/* Discovery feedback message */}
          {discoveryMessage && (
            <div className={`mb-3 p-2 rounded text-sm ${
              discoveryMessage.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : discoveryMessage.includes('🚀')
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {discoveryMessage}
            </div>
          )}

          {/* Real-time discovery progress */}
          {discoveryProgress && discoveryProgress.running && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Discovery Run #{discoveryProgress.discoveryRunId}
                </span>
                <span className="text-xs text-blue-700">
                  {discoveryProgress.progress}% complete ({discoveryProgress.completedScrapers}/{discoveryProgress.totalScrapers})
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${discoveryProgress.progress}%` }}
                ></div>
              </div>
              
              {/* Current scraper */}
              {discoveryProgress.currentScraper && (
                <div className="text-xs text-blue-800 flex items-center">
                  <div className="animate-spin mr-2 w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  Running: <strong className="ml-1">{discoveryProgress.currentScraper.displayName}</strong>
                </div>
              )}
              
              {/* Completed scrapers summary */}
              {discoveryProgress.scraperResults.length > 0 && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="text-xs text-blue-700 space-y-1 max-h-20 overflow-y-auto">
                    {discoveryProgress.scraperResults.slice(-3).map((result, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="flex items-center">
                          {result.success ? '✅' : '❌'}
                          <span className="ml-1 truncate">{result.displayName}</span>
                        </span>
                        <span>{result.eventsFound} events</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={runDiscoveryNow}
              disabled={discoveryRunning}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                discoveryRunning
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
              }`}
            >
              {discoveryRunning ? (
                <>🔄 Running Discovery...</>
              ) : (
                <>🔍 Run Discovery Now</>
              )}
            </button>
            <button className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full hover:bg-green-200">
              📧 View Email Approvals
            </button>
            <button className="px-3 py-1 bg-orange-100 text-orange-800 text-sm rounded-full hover:bg-orange-200">
              ⚠️ Check Email Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}