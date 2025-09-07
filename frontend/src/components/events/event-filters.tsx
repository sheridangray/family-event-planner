"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDownIcon, XMarkIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

interface EventFiltersProps {
  searchParams: {
    status?: string;
    search?: string;
    venue?: string;
    cost?: string;
    age?: string;
    page?: string;
  };
}

export function EventFilters({ searchParams }: EventFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const currentFilters = {
    status: searchParams.status || "all",
    venue: searchParams.venue,
    cost: searchParams.cost,
    age: searchParams.age,
  };

  const statusOptions = [
    { value: "all", label: "All Events", count: 47 },
    { value: "pending", label: "Pending", count: 12 },
    { value: "approved", label: "Approved", count: 8 },
    { value: "registered", label: "Registered", count: 15 },
    { value: "rejected", label: "Rejected", count: 12 },
  ];

  const quickFilters = [
    { key: "cost", value: "free", label: "💰 Free Events", active: currentFilters.cost === "free" },
    { key: "venue", value: "cal-academy", label: "📍 Cal Academy", active: currentFilters.venue === "cal-academy" },
    { key: "age", value: "perfect", label: "👶 Ages 2-4", active: currentFilters.age === "perfect" },
    { key: "status", value: "new", label: "🆕 New Today", active: false },
  ];

  const buildFilterUrl = (filterKey: string, value: string) => {
    const params = new URLSearchParams();
    
    // Keep existing filters
    Object.entries(currentFilters).forEach(([key, val]) => {
      if (val && key !== filterKey) {
        params.set(key, val);
      }
    });
    
    // Add new filter (or remove if clicking the same value)
    if (currentFilters[filterKey as keyof typeof currentFilters] !== value) {
      params.set(filterKey, value);
    }
    
    return `/dashboard/events${params.toString() ? `?${params.toString()}` : ''}`;
  };

  const clearAllFilters = () => {
    return "/dashboard/events";
  };

  const hasActiveFilters = Object.values(currentFilters).some(val => val && val !== "all");

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        {/* Primary Filters */}
        <div className="flex items-center space-x-3 mb-3">
          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={currentFilters.status}
              onChange={(e) => window.location.href = buildFilterUrl("status", e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Date Range Dropdown */}
          <div className="relative">
            <select className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option>This Week</option>
              <option>Next Week</option>
              <option>This Month</option>
              <option>Custom Range</option>
            </select>
            <ChevronDownIcon className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              showAdvanced 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4 mr-1" />
            Filters
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {quickFilters.map((filter) => (
            <Link
              key={`${filter.key}-${filter.value}`}
              href={buildFilterUrl(filter.key, filter.value)}
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter.active
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </Link>
          ))}
          
          {hasActiveFilters && (
            <Link
              href={clearAllFilters()}
              className="inline-flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-3 w-3 mr-1" />
              Clear all
            </Link>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Location Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📍 Location
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Within 20 miles</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Cal Academy</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">SF Library</span>
                  </label>
                </div>
              </div>

              {/* Cost Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💰 Cost
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Free only</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Under $25</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Under $50</span>
                  </label>
                </div>
              </div>

              {/* Event Type Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🏷️ Event Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Arts & Crafts</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Science</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="ml-2 text-sm text-gray-700">Educational</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => setShowAdvanced(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Close Filters
              </button>
              <div className="space-x-2">
                <button className="px-3 py-1 text-sm text-gray-700 hover:text-gray-900">
                  Reset
                </button>
                <button className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}