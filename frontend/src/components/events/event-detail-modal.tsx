"use client";

import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { format } from "date-fns";
import {
  XMarkIcon,
  ClockIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  StarIcon,
  LinkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { Event } from "@/lib/api";

/*interface Event {
  id: string;
  title: string;
  date: Date;
  time: string;
  location: {
    name: string;
    address: string;
    distance: string;
  };
  cost: number;
  ageRange: { min: number; max: number };
  status: 'pending' | 'approved' | 'registered' | 'rejected' | 'manual_required';
  description: string;
  registrationUrl: string;
  socialProof: {
    rating: number;
    reviewCount: number;
    tags: string[];
  };
  context: {
    weather?: string | null;
    preferences?: string | null;
    urgency?: string | null;
  };
  source: string;
  autoRegistration: string | null;
}*/

interface EventDetailModalProps {
  event: Event;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function EventDetailModal({ event, onClose, onApprove, onReject }: EventDetailModalProps) {
  const formattedDate = format(new Date(event.date), 'EEEE, MMMM d, yyyy');

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Event Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Event Photo Placeholder */}
                  <div className="w-full h-48 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg mb-6 flex items-center justify-center">
                    <div className="text-white text-6xl">🎨</div>
                  </div>

                  {/* Event Title and Date */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {event.title}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column - Event Details */}
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <ClockIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-gray-900">{formattedDate}</div>
                          <div className="text-gray-600">{event.time}</div>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <MapPinIcon className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                        <div>
                          <div className="font-medium text-gray-900">{event.location.name}</div>
                          <div className="text-gray-600">{event.location.address}</div>
                          <div className="text-sm text-gray-500">
                            🚗 {event.location.distance} • 🅿️ Street parking
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <CurrencyDollarIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="font-medium text-gray-900">
                            {event.cost === "0.00" || event.cost === "0" ? 'FREE' : `$${event.cost} per family`}
                          </div>
                          <div className="text-gray-600">
                            Recommended for ages {event.ageRange.min}-{event.ageRange.max}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Social Proof & Context */}
                    <div className="space-y-4">
                      {event.socialProof && (
                        <div>
                          <h3 className="font-medium text-gray-900 mb-2">🌟 REVIEWS & RATINGS</h3>
                          <div className="flex items-center mb-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon 
                                  key={i} 
                                  className={`h-4 w-4 ${
                                    i < Math.floor(parseFloat(event.socialProof!.rating))
                                      ? 'text-yellow-400 fill-current' 
                                      : 'text-gray-300'
                                  }`} 
                                />
                              ))}
                            </div>
                            <span className="ml-2 text-sm text-gray-600">
                              {event.socialProof.rating}/5 ({event.socialProof.reviewCount} reviews)
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {event.socialProof.tags.map((tag, index) => (
                              <span 
                                key={index}
                                className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Context Information */}
                      {(event.context?.weather || event.context?.preferences || event.context?.urgency) && (
                        <div>
                          <h3 className="font-medium text-gray-900 mb-2">💡 INSIGHTS</h3>
                          <div className="space-y-2">
                            {event.context?.weather && (
                              <div className="text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                🌤️ {event.context.weather}
                              </div>
                            )}
                            {event.context?.preferences && (
                              <div className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded">
                                💡 {event.context.preferences}
                              </div>
                            )}
                            {event.context?.urgency && (
                              <div className="text-sm text-orange-700 bg-orange-50 px-2 py-1 rounded">
                                ⚠️ {event.context.urgency}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">📝 ABOUT THE EVENT</h3>
                    <p className="text-gray-700 leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  {/* What to Expect */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">🎯 WHAT TO EXPECT</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-700">
                      <li>All art supplies provided</li>
                      <li>Pizza dinner included</li>
                      <li>Take home your creations</li>
                      <li>Family-friendly atmosphere</li>
                    </ul>
                  </div>

                  {/* Registration Status */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">🤖 REGISTRATION STATUS</h3>
                    <div className="flex items-center justify-between">
                      <div>
                        {event.autoRegistration === 'ready' ? (
                          <div className="flex items-center text-green-700">
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            Auto-registration ready
                          </div>
                        ) : (
                          <div className="text-gray-600">
                            Manual registration required
                          </div>
                        )}
                      </div>
                      <a
                        href={event.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-indigo-600 hover:text-indigo-800"
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Manual Link
                      </a>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                {event.status === 'pending' && (
                  <div className="bg-gray-50 px-6 py-4 flex justify-between">
                    <button
                      onClick={onReject}
                      className="flex items-center px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      <XCircleIcon className="h-5 w-5 mr-2" />
                      Not Interested
                    </button>
                    
                    <div className="space-x-3">
                      <button
                        onClick={() => {
                          // TODO: Open manual registration
                          window.open(event.registrationUrl, '_blank');
                        }}
                        className="px-4 py-2 text-indigo-700 border border-indigo-300 rounded-lg hover:bg-indigo-50"
                      >
                        📧 Approve & Send Manual Link
                      </button>
                      <button
                        onClick={onApprove}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        👍 Approve & Auto-Register
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}