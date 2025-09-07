"use client";

import { useState } from "react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addWeeks,
} from "date-fns";

// Mock calendar events data
const calendarEvents = [
  {
    id: "1",
    title: "Family Paint & Pizza Night",
    date: addDays(new Date(), 2),
    time: "6:00 PM",
    status: "registered" as const,
    color: "green",
  },
  {
    id: "2", 
    title: "Science Saturdays",
    date: addDays(new Date(), 5),
    time: "10:00 AM",
    status: "approved" as const,
    color: "blue",
  },
  {
    id: "3",
    title: "Story Time Adventures",
    date: addWeeks(new Date(), 1),
    time: "11:00 AM",
    status: "registered" as const,
    color: "green",
  },
  {
    id: "4",
    title: "Cooking Workshop",
    date: addDays(new Date(), 12),
    time: "2:00 PM", 
    status: "approved" as const,
    color: "blue",
  },
];

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  time: string;
  status: 'approved' | 'registered';
  color: string;
}

export function CalendarView() {
  const [currentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;
  
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return calendarEvents.filter(event => 
      isSameDay(event.date, date)
    );
  };

  const getEventColor = (status: string) => {
    switch (status) {
      case 'registered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Calendar Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Calendar View</h3>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, dayIdx) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isDayToday = isToday(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={dayIdx}
                onClick={() => setSelectedDate(day)}
                className={`
                  min-h-[80px] p-1 border border-gray-100 cursor-pointer transition-colors
                  ${isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'}
                  ${isSelected ? 'bg-indigo-50 border-indigo-200' : ''}
                  ${isDayToday ? 'ring-2 ring-indigo-500' : ''}
                `}
              >
                <div className={`
                  text-sm font-medium mb-1
                  ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                  ${isDayToday ? 'text-indigo-600' : ''}
                `}>
                  {format(day, 'd')}
                </div>
                
                {/* Event Dots for Mobile, Event Bars for Desktop */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="block">
                      {/* Mobile: Small colored dots */}
                      <div className="md:hidden flex space-x-1">
                        <div className={`w-2 h-2 rounded-full ${
                          event.status === 'registered' ? 'bg-green-500' : 'bg-blue-500'
                        }`}></div>
                      </div>
                      
                      {/* Desktop: Event bars */}
                      <div className={`
                        hidden md:block text-xs px-1 py-0.5 rounded truncate border
                        ${getEventColor(event.status)}
                      `}>
                        {event.time} {event.title}
                      </div>
                    </div>
                  ))}
                  
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Events Panel - Mobile */}
      {selectedDate && selectedDateEvents.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 md:hidden">
          <h4 className="font-medium text-gray-900 mb-2">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h4>
          <div className="space-y-2">
            {selectedDateEvents.map((event) => (
              <div key={event.id} className="bg-white p-2 rounded border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{event.title}</div>
                    <div className="text-xs text-gray-600">{event.time}</div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    event.status === 'registered' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {event.status === 'registered' ? '🎯' : '✅'} {event.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex flex-wrap items-center justify-center space-x-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
            <span className="text-gray-600">Registered</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-1"></div>
            <span className="text-gray-600">Approved</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 border-2 border-indigo-500 rounded mr-1"></div>
            <span className="text-gray-600">Today</span>
          </div>
        </div>
      </div>
    </div>
  );
}