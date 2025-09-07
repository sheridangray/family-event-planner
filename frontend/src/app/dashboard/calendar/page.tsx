import { CalendarHeader } from "@/components/calendar/calendar-header";
import { CalendarView } from "@/components/calendar/calendar-view";
import { UpcomingEvents } from "@/components/calendar/upcoming-events";
import { Suspense } from "react";

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CalendarHeader />
      
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Mobile: Stack upcoming events first, then calendar */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Upcoming Events - Full width on mobile, sidebar on desktop */}
          <div className="lg:col-span-1 mb-6 lg:mb-0">
            <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
              <UpcomingEvents />
            </Suspense>
          </div>

          {/* Calendar View - Full width on mobile, main area on desktop */}
          <div className="lg:col-span-2">
            <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
              <CalendarView />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}