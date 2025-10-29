"use client";

import { 
  CalendarIcon, 
  MapPinIcon, 
  CurrencyDollarIcon,
  ClockIcon,
  HeartIcon,
  LinkIcon,
  CloudIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

interface EventCardProps {
  event: {
    rank: number;
    pickType: string;
    score: number;
    event: {
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      location: {
        name: string;
        address: string;
        distanceMiles: number;
      };
      cost: {
        adult?: number;
        child?: number;
        infantFree?: boolean;
        currency: string;
      };
      description: string;
      weather?: {
        forecast: string;
        riskLevel: string;
      };
      urls: {
        eventPage: string;
        registration?: string;
        addToCalendar: string;
      };
      calendarConflict?: boolean;
    };
    reasoning: string;
  };
  isInterested: boolean;
  onToggleInterest: () => void;
}

export function EventCard({ event, isInterested, onToggleInterest }: EventCardProps) {
  const isTopPick = event.rank <= 3;
  const pickTypeColors: Record<string, string> = {
    'TOP PICK': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'SECOND CHOICE': 'bg-blue-100 text-blue-800 border-blue-300',
    'THIRD CHOICE': 'bg-green-100 text-green-800 border-green-300',
    'DEFAULT': 'bg-gray-100 text-gray-800 border-gray-300'
  };

  const pickTypeColor = pickTypeColors[event.pickType] || pickTypeColors['DEFAULT'];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    // Handle both full ISO timestamps and time strings
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timeStr;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md border-2 ${isTopPick ? 'border-indigo-500' : 'border-gray-200'} p-6 hover:shadow-lg transition-shadow`}>
      {/* Header with Rank and Pick Type */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${
            isTopPick ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'
          }`}>
            {event.rank}
          </div>
          <div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${pickTypeColor}`}>
              {event.pickType}
            </span>
            <div className="text-sm text-gray-600 mt-1">Score: {event.score}/10</div>
          </div>
        </div>
        
        <button
          onClick={onToggleInterest}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title={isInterested ? "Remove from interested" : "Mark as interested"}
        >
          {isInterested ? (
            <HeartIconSolid className="h-6 w-6 text-red-500" />
          ) : (
            <HeartIcon className="h-6 w-6 text-gray-400" />
          )}
        </button>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-gray-900 mb-3">{event.event.title}</h3>

      {/* Date and Time */}
      <div className="flex items-start space-x-2 text-gray-700 mb-2">
        <CalendarIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">{formatDate(event.event.date)}</div>
          {event.event.startTime && (
            <div className="text-sm text-gray-600">
              {formatTime(event.event.startTime)}
              {event.event.endTime && ` - ${formatTime(event.event.endTime)}`}
            </div>
          )}
        </div>
      </div>

      {/* Location */}
      <div className="flex items-start space-x-2 text-gray-700 mb-2">
        <MapPinIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-medium">{event.event.location.name}</div>
          <div className="text-sm text-gray-600">{event.event.location.address}</div>
          <div className="text-sm text-indigo-600">{event.event.location.distanceMiles} miles away</div>
        </div>
      </div>

      {/* Cost */}
      <div className="flex items-center space-x-2 text-gray-700 mb-3">
        <CurrencyDollarIcon className="h-5 w-5 flex-shrink-0" />
        <div className="text-sm">
          {event.event.cost.adult !== undefined && (
            <span>Adult: ${event.event.cost.adult}</span>
          )}
          {event.event.cost.child !== undefined && (
            <span className="ml-2">Child: ${event.event.cost.child}</span>
          )}
          {event.event.cost.infantFree && (
            <span className="ml-2 text-green-600 font-medium">Infant Free</span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-700 text-sm mb-3 line-clamp-3">{event.event.description}</p>

      {/* Weather Info */}
      {event.event.weather && (
        <div className={`flex items-start space-x-2 p-3 rounded-lg mb-3 ${
          event.event.weather.riskLevel === 'high' ? 'bg-red-50 text-red-700' :
          event.event.weather.riskLevel === 'medium' ? 'bg-yellow-50 text-yellow-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          <CloudIcon className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium">Weather: {event.event.weather.forecast}</div>
            {event.event.weather.riskLevel !== 'low' && (
              <div className="text-xs mt-1">Risk: {event.event.weather.riskLevel}</div>
            )}
          </div>
        </div>
      )}

      {/* Calendar Conflict Warning */}
      {event.event.calendarConflict && (
        <div className="flex items-center space-x-2 p-3 bg-orange-50 text-orange-700 rounded-lg mb-3">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">Calendar conflict detected</span>
        </div>
      )}

      {/* Reasoning */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Why this event?</div>
        <p className="text-sm text-gray-700">{event.reasoning}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <a
          href={event.event.urls.addToCalendar}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <CalendarIcon className="h-4 w-4 mr-2" />
          Add to Calendar
        </a>
        
        {event.event.urls.registration && (
          <a
            href={event.event.urls.registration}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Register
          </a>
        )}
        
        <a
          href={event.event.urls.eventPage}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          <LinkIcon className="h-4 w-4 mr-2" />
          Details
        </a>
      </div>
    </div>
  );
}

