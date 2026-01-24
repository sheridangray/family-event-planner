"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export function LatestDiscoveryRun() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.getAutomationStatus();
        setStatus(data);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">🎉 Kids Event Discovery</h3>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="font-medium text-blue-900">New Discovery System Active</span>
        </div>
        <p className="text-sm text-blue-700">
          The new Kids Event Discovery system uses ground-truth sources (Google Search, Eventbrite, Newsletters) 
          with LLM-powered content extraction and probabilistic filtering.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">3</div>
          <div className="text-xs text-gray-600">Active Sources</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">2x Daily</div>
          <div className="text-xs text-gray-600">Discovery Schedule</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Use the iOS app to browse discovered events and manage preferences.
        </p>
      </div>
    </div>
  );
}
