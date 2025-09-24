"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface SystemHealth {
  systemStatus: string;
  healthScore: number;
  components: {
    database: boolean;
    scrapers: boolean;
    googleIntegration: boolean;
    emailService: boolean;
    calendarIntegration: boolean;
    databasePerformance: boolean;
    systemResources: boolean;
    scheduler: boolean;
    weatherService: boolean;
  };
  performance: {
    discoveryEngineScore: number;
    basicDatabaseResponseTime: string;
    complexDatabaseResponseTime: string;
    memoryUsageMB: number;
    memoryTotalMB: number;
    uptimeHours: number;
  };
  lastHealthCheck: string;
}

export function SystemHealth() {
  const [healthMetrics, setHealthMetrics] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await api.getSystemHealth();
        setHealthMetrics(data);
      } catch (error) {
        console.error('Error fetching system health:', error);
        setError('Failed to load system health');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000);

    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (isHealthy: boolean) => {
    return isHealthy 
      ? 'text-green-600 bg-green-100'
      : 'text-red-600 bg-red-100';
  };

  const getHealthIcon = (isHealthy: boolean) => {
    return isHealthy ? '✅' : '❌';
  };

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

  const getNextHealthCheck = () => {
    // Health checks run every 15 minutes
    const now = new Date();
    const currentMinutes = now.getMinutes();
    
    // Find next 15-minute interval (0, 15, 30, 45)
    const intervals = [0, 15, 30, 45];
    let nextInterval = intervals.find(interval => interval > currentMinutes);
    
    // If no interval found in current hour, use first interval of next hour
    if (!nextInterval) {
      nextInterval = intervals[0];
    }
    
    // Calculate next check time
    const nextCheck = new Date(now);
    if (nextInterval === 0 && currentMinutes >= 45) {
      // Next hour at 0 minutes
      nextCheck.setHours(nextCheck.getHours() + 1);
    }
    nextCheck.setMinutes(nextInterval, 0, 0);
    
    // Calculate time difference
    const diffMs = nextCheck.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes === 0) {
      return 'Less than 1 minute';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      const remainingMinutes = diffMinutes % 60;
      return remainingMinutes > 0 ? `${diffHours}h ${remainingMinutes}m` : `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">🏥 System Health</h3>
          {healthMetrics && (
            <div className="text-right">
              <div className="text-sm text-gray-600">
                {formatTimeAgo(healthMetrics.lastHealthCheck)}
              </div>
              <div className="text-xs text-gray-500">
                Next: {getNextHealthCheck()}
              </div>
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="animate-pulse">
            <div className="text-center mb-6">
              <div className="w-16 h-12 bg-gray-200 rounded mx-auto mb-2"></div>
              <div className="w-32 h-4 bg-gray-200 rounded mx-auto mb-2"></div>
              <div className="w-full h-2 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-gray-200 rounded mr-3"></div>
                    <div className="w-24 h-4 bg-gray-200 rounded"></div>
                  </div>
                  <div className="w-16 h-6 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
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
        ) : healthMetrics ? (
          <>
            {/* Overall Health Score */}
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {Math.round(healthMetrics.healthScore)}%
              </div>
              <div className="text-sm text-gray-600 capitalize">{healthMetrics.systemStatus} System Health</div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ width: `${healthMetrics.healthScore}%` }}
                ></div>
              </div>
            </div>

            {/* Component Health */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.database)}</span>
                  <span className="font-medium">Database</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.database)
                  }`}>
                    {healthMetrics.components.database ? 'healthy' : 'error'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.emailService)}</span>
                  <span className="font-medium">Email Service</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.emailService)
                  }`}>
                    {healthMetrics.components.emailService ? 'healthy' : 'error'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.calendarIntegration)}</span>
                  <span className="font-medium">Calendar Integration</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.calendarIntegration)
                  }`}>
                    {healthMetrics.components.calendarIntegration ? 'healthy' : 'error'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.databasePerformance)}</span>
                  <span className="font-medium">Database Performance</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.databasePerformance)
                  }`}>
                    {healthMetrics.components.databasePerformance ? 'healthy' : 'slow'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Basic: {healthMetrics.performance.basicDatabaseResponseTime} | Complex: {healthMetrics.performance.complexDatabaseResponseTime}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.systemResources)}</span>
                  <span className="font-medium">System Resources</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.systemResources)
                  }`}>
                    {healthMetrics.components.systemResources ? 'healthy' : 'high usage'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Memory: {healthMetrics.performance.memoryUsageMB}MB / {healthMetrics.performance.memoryTotalMB}MB
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.googleIntegration)}</span>
                  <span className="font-medium">Google Integration</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.googleIntegration)
                  }`}>
                    {healthMetrics.components.googleIntegration ? 'authenticated' : 'auth failed'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Calendar + Email API
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.scrapers)}</span>
                  <span className="font-medium">Discovery Engine</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.scrapers)
                  }`}>
                    {healthMetrics.components.scrapers ? 'healthy' : 'error'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Score: {healthMetrics.performance.discoveryEngineScore}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.scheduler)}</span>
                  <span className="font-medium">Task Scheduler</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.scheduler)
                  }`}>
                    {healthMetrics.components.scheduler ? 'running' : 'stopped'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.weatherService)}</span>
                  <span className="font-medium">Weather Service</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.weatherService)
                  }`}>
                    {healthMetrics.components.weatherService ? 'operational' : 'unavailable'}
                  </div>
                </div>
              </div>
            </div>

          </>
        ) : null}
      </div>
    </div>
  );
}