"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface SystemHealth {
  systemStatus: string;
  healthScore: number;
  components: {
    database: boolean;
    scrapers: boolean;
    mcp: boolean;
    automation: boolean;
    scheduler: boolean;
  };
  performance: {
    registrationSuccessRate: string;
    avgResponseTime: string;
    totalActions24h: number;
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏥 System Health</h3>
        
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
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.automation)}</span>
                  <span className="font-medium">Registration Bot</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.automation)
                  }`}>
                    {healthMetrics.components.automation ? 'healthy' : 'error'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Success: {healthMetrics.performance.registrationSuccessRate}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="mr-2">{getHealthIcon(healthMetrics.components.mcp)}</span>
                  <span className="font-medium">MCP Services</span>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    getHealthColor(healthMetrics.components.mcp)
                  }`}>
                    {healthMetrics.components.mcp ? 'healthy' : 'warning'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Avg: {healthMetrics.performance.avgResponseTime}
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
                    24h: {healthMetrics.performance.totalActions24h} actions
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
            </div>

            {/* System Actions */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button className="w-full px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                View Detailed Logs →
              </button>
              <div className="text-xs text-gray-500 text-center mt-2">
                Last check: {new Date(healthMetrics.lastHealthCheck).toLocaleTimeString()}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}