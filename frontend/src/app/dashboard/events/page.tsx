import { Suspense } from "react";
import { EventsHeader } from "@/components/events/events-header";
import { EventFilters } from "@/components/events/event-filters";
import { EventsList } from "@/components/events/events-list";
import { EventsLoading } from "@/components/events/events-loading";

interface EventsPageProps {
  searchParams: {
    status?: string;
    search?: string;
    venue?: string;
    cost?: string;
    age?: string;
    page?: string;
  };
}

export default function EventsPage({ searchParams }: EventsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with title and search */}
      <EventsHeader />
      
      {/* Filters */}
      <EventFilters searchParams={searchParams} />
      
      {/* Events List */}
      <Suspense fallback={<EventsLoading />}>
        <EventsList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}