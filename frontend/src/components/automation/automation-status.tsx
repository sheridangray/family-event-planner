"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface AutomationStats {
  status: string;
  message: string;
  timestamp: string;
}

export function AutomationStatus() {
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getAutomationStatus();
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
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Automation Status</h3>
        
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${stats?.status === 'operational' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-sm font-medium text-gray-700">
            {stats?.status === 'operational' ? 'System Operational' : stats?.status}
          </span>
        </div>

        {stats?.message && (
          <p className="text-sm text-gray-600 mb-4">{stats.message}</p>
        )}

        <div className="text-xs text-gray-400">
          Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Unknown'}
        </div>
      </div>
    </div>
  );
}
