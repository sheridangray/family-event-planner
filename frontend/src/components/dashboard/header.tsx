"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { format } from "date-fns";

interface DashboardHeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const now = new Date();
  const timeOfDay = now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening";
  const greeting = `Good ${timeOfDay}`;

  return (
    <header className="pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {user.name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-sm text-gray-600">
            Today is {format(now, "EEEE, MMMM d")}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Weather placeholder */}
          <div className="text-sm text-gray-600">
            ☀️ 72°F
          </div>

          {/* User avatar */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex-shrink-0"
          >
            {user.image ? (
              <Image
                className="h-10 w-10 rounded-full"
                src={user.image}
                alt={user.name || "Profile"}
                width={40}
                height={40}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}