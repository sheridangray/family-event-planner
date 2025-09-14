"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, QuickStats as QuickStatsType, ApiError } from "@/lib/api";

export function QuickStats() {
  const [stats, setStats] = useState<QuickStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const dashboardData = await api.getDashboard();
        setStats(dashboardData.quickStats);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof ApiError ? err.message : 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 p-3 rounded-lg animate-pulse">
            <div className="text-center">
              <div className="bg-gray-300 h-3 w-16 mx-auto mb-2 rounded"></div>
              <div className="bg-gray-300 h-3 w-12 mx-auto mb-2 rounded"></div>
              <div className="bg-gray-300 h-6 w-8 mx-auto mb-1 rounded"></div>
              <div className="bg-gray-300 h-3 w-14 mx-auto rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="col-span-3 bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-center">
          <p className="text-sm">{error || 'Failed to load stats'}</p>
        </div>
      </div>
    );
  }

  const statsConfig = [
    {
      label: "PENDING",
      sublabel: "Review",
      value: stats.pendingReview.toString(),
      change: `${stats.totalEvents} total`,
      href: "/dashboard/events?status=pending",
      color: "bg-yellow-50 border-yellow-200 text-yellow-800",
    },
    {
      label: "APPROVED",
      sublabel: "Events",
      value: stats.approved.toString(),
      change: `${stats.registered} registered`,
      href: "/dashboard/events?status=approved",
      color: "bg-green-50 border-green-200 text-green-800",
    },
    {
      label: "AUTO-REG",
      sublabel: "Status",
      value: stats.automationActive ? "ON" : "OFF",
      change: stats.automationActive ? "Active" : "Inactive",
      href: "/dashboard/automation",
      color: stats.automationActive 
        ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {statsConfig.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className={`${stat.color} p-3 rounded-lg border transition-colors hover:opacity-80`}
        >
          <div className="text-center">
            <div className="text-xs font-medium opacity-75 mb-1">
              {stat.label}
            </div>
            <div className="text-xs opacity-75 mb-2">{stat.sublabel}</div>
            <div className="text-xl font-bold mb-1">{stat.value}</div>
            <div className="text-xs opacity-75">{stat.change}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}