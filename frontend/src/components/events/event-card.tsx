"use client";

import { useState } from "react";
import { format } from "date-fns";
import { 
  ClockIcon, 
  MapPinIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  StarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolid,
} from "@heroicons/react/24/solid";

import { Event } from "@/lib/api";

interface EventCardProps {
  event: Event;
  isSelected: boolean;
  onSelect: () => void;
  onViewDetails: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function EventCard({ 
  event, 
  isSelected, 
  onSelect, 
  onViewDetails, 
  onApprove, 
  onReject 
}: EventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadge = () => {
    switch (event.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            ⏳ Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            ✅ Approved
          </span>
        );
      case 'registered':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            🎯 Registered
          </span>
        );
      case 'manual_required':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            📧 Manual
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            ❌ Rejected
          </span>
        );
    }
  };

  const getContextAlerts = () => {
    const alerts = [];
    
    if (event.context?.urgency) {
      alerts.push(
        <div key="urgency" className="flex items-center text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
          <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
          {event.context.urgency}
        </div>
      );
    }
    
    if (event.context?.weather) {
      alerts.push(
        <div key="weather" className="text-xs text-blue-600">
          {event.context.weather}
        </div>
      );
    }

    if (event.context?.preferences) {
      alerts.push(
        <div key="preferences" className="text-xs text-green-600">
          💡 {event.context.preferences}
        </div>
      );
    }

    return alerts;
  };

  return (
    <div className={`bg-white rounded-lg border-2 transition-all ${
      isSelected 
        ? 'border-indigo-500 shadow-lg' 
        : 'border-gray-200 shadow-sm hover:shadow-md'
    }`}>
      <div className="p-4">
        {/* Header with checkbox and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3">
            {event.status === 'pending' && (
              <button
                onClick={onSelect}
                className="mt-1 flex-shrink-0"
              >
                {isSelected ? (
                  <CheckCircleSolid className="h-5 w-5 text-indigo-600" />
                ) : (
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                )}
              </button>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {event.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  {format(new Date(event.date), 'EEE, MMM d')} • {event.time}
                </span>
              </div>
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Location and Cost */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="flex items-start">
            <MapPinIcon className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-gray-900">{event.location.name}</div>
              {event.location.distance && <div className="text-xs text-gray-600">{event.location.distance}</div>}
            </div>
          </div>
          
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-2" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {event.cost === '0' || event.cost === '' ? 'FREE' : `$${event.cost}`}
              </div>
              <div className="text-xs text-gray-600">
                Ages {event.ageRange.min}-{event.ageRange.max}
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof */}
        {event.socialProof && (
          <div className="flex items-center space-x-4 mb-3">
            <div className="flex items-center">
              <StarIcon className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="text-sm text-gray-600 ml-1">
                {event.socialProof.rating} ({event.socialProof.reviewCount})
              </span>
            </div>
            <div className="flex space-x-1">
              {event.socialProof.tags.map((tag, index) => (
                <span 
                  key={index}
                  className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Context Alerts */}
        {getContextAlerts().length > 0 && (
          <div className="space-y-1 mb-3">
            {getContextAlerts()}
          </div>
        )}

        {/* Status-specific information */}
        {event.status === 'registered' && event.confirmationNumber && (
          <div className="bg-green-50 border border-green-200 rounded p-2 mb-3">
            <div className="text-sm text-green-800">
              🎫 Confirmation: <span className="font-medium">{event.confirmationNumber}</span>
            </div>
          </div>
        )}

        {event.status === 'rejected' && event.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
            <div className="text-sm text-red-800">
              Reason: {event.rejectionReason}
            </div>
          </div>
        )}

        {event.status === 'manual_required' && event.failureReason && (
          <div className="bg-orange-50 border border-orange-200 rounded p-2 mb-3">
            <div className="text-sm text-orange-800">
              ⚠️ {event.failureReason}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={onViewDetails}
            className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
          >
            <InformationCircleIcon className="h-4 w-4 mr-1" />
            Details
          </button>

          {event.status === 'pending' && (
            <div className="flex space-x-2">
              <button
                onClick={onReject}
                className="flex items-center px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
              >
                <XCircleIcon className="h-4 w-4 mr-1" />
                Pass
              </button>
              <button
                onClick={onApprove}
                className="flex items-center px-3 py-1 text-sm text-white bg-green-600 rounded hover:bg-green-700"
              >
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}