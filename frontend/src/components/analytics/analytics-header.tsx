"use client";

import { useState } from "react";
import { ChevronDownIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

export function AnalyticsHeader() {
  const [timeRange, setTimeRange] = useState('last-30-days');
  const [selectedChild, setSelectedChild] = useState('all');

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics & Insights</h1>
            <p className="text-sm text-gray-600 mt-1">
              Discover patterns in your family's event participation
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="flex items-center px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 border border-indigo-300 rounded-lg">
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              Export Report
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Time Range Filter */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="last-7-days">Last 7 Days</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="last-90-days">Last 3 Months</option>
              <option value="last-year">Last Year</option>
              <option value="all-time">All Time</option>
            </select>
            <ChevronDownIcon className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Child Filter */}
          <div className="relative">
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Children</option>
              <option value="emma">Emma (4 years)</option>
              <option value="liam">Liam (2 years)</option>
            </select>
            <ChevronDownIcon className="absolute right-2 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Quick Stats */}
          <div className="hidden md:flex items-center space-x-6 ml-6 text-sm">
            <div>
              <span className="text-gray-600">Events Attended:</span>
              <span className="font-semibold text-gray-900 ml-1">34</span>
            </div>
            <div>
              <span className="text-gray-600">Total Saved:</span>
              <span className="font-semibold text-green-600 ml-1">$428</span>
            </div>
            <div>
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-semibold text-indigo-600 ml-1">89%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}