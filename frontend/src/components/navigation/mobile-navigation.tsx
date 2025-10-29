"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  HomeIcon,
  CalendarDaysIcon,
  ListBulletIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ListBulletIcon as ListBulletIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  CpuChipIcon as CpuChipIconSolid,
  SparklesIcon as SparklesIconSolid,
} from "@heroicons/react/24/solid";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    activeIcon: HomeIconSolid,
  },
  {
    name: "Events",
    href: "/dashboard/events",
    icon: ListBulletIcon,
    activeIcon: ListBulletIconSolid,
  },
  {
    name: "AI Picks",
    href: "/dashboard/chatgpt-suggestions",
    icon: SparklesIcon,
    activeIcon: SparklesIconSolid,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Cog6ToothIcon,
    activeIcon: Cog6ToothIconSolid,
  },
];

export function MobileNavigation() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <nav className="flex justify-between items-center">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = isActive ? item.activeIcon : item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex flex-col items-center px-2 py-1 rounded-lg transition-colors",
                isActive
                  ? "text-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}