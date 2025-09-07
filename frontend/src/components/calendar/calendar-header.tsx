"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, ListBulletIcon } from "@heroicons/react/24/outline";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

export function CalendarHeader() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-7xl mx-auto">
        {/* Title and Stats */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📅 Family Calendar</h1>
            <p className="text-sm text-gray-600 mt-1">
              12 events this month • 3 this week
            </p>
          </div>
          
          {/* View Mode Toggle - Desktop only */}
          <div className="hidden md:flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'month' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'week' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListBulletIcon className="h-4 w-4 mr-1" />
              List
            </button>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Month Navigation */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              
              <h2 className="text-lg font-semibold text-gray-900 min-w-[140px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRightIcon className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            
            {/* Today Button */}
            <button
              onClick={goToToday}
              className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Today
            </button>
          </div>

          {/* Mobile View Toggle */}
          <div className="md:hidden">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'month' | 'week' | 'list')}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="list">List</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}