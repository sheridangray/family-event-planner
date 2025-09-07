"use client";

import Link from "next/link";
import { 
  BoltIcon, 
  CheckBadgeIcon, 
  ChartBarIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

export function QuickActions() {
  const actions = [
    {
      name: "Scan Now",
      icon: BoltIcon,
      href: "/dashboard/automation?action=scan",
      badge: null,
    },
    {
      name: "Approvals",
      icon: CheckBadgeIcon,
      href: "/dashboard/events?status=pending",
      badge: "7",
    },
    {
      name: "Stats",
      icon: ChartBarIcon,
      href: "/dashboard/analytics",
      badge: null,
    },
    {
      name: "Settings",
      icon: Cog6ToothIcon,
      href: "/dashboard/settings",
      badge: null,
    },
    {
      name: "Manual Add",
      icon: MagnifyingGlassIcon,
      href: "/dashboard/events/add",
      badge: null,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center space-x-2">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className="flex-1 flex flex-col items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors relative"
          >
            <action.icon className="w-6 h-6 text-gray-600 mb-1" />
            <span className="text-xs font-medium text-gray-900 text-center">
              {action.name}
            </span>
            
            {action.badge && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {action.badge}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}