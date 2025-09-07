"use client";

import Link from "next/link";

export function QuickStats() {
  // Mock data - will be replaced with real API calls
  const stats = [
    {
      label: "PENDING",
      sublabel: "Approvals",
      value: "7",
      change: "+3 today",
      href: "/dashboard/events?status=pending",
      color: "bg-yellow-50 border-yellow-200 text-yellow-800",
    },
    {
      label: "THIS WEEK",
      sublabel: "Events",
      value: "4",
      change: "2 outdoor",
      href: "/dashboard/calendar",
      color: "bg-blue-50 border-blue-200 text-blue-800",
    },
    {
      label: "AUTO-REG",
      sublabel: "Success",
      value: "92%",
      change: "23 of 25",
      href: "/dashboard/automation",
      color: "bg-green-50 border-green-200 text-green-800",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {stats.map((stat) => (
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