"use client";

import { useState } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";

export function LocationSettings() {
  const [location, setLocation] = useState({
    address: "123 Main Street, San Francisco, CA 94102",
    latitude: 37.7749,
    longitude: -122.4194,
  });

  const handleUpdateLocation = () => {
    // TODO: Integrate with location API
    console.log('Updating location...');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Home Location</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Home Address
            </label>
            <div className="flex items-center">
              <MapPinIcon className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-gray-900">{location.address}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              This is used to calculate travel times and distances to events
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-2">🌍 Location Privacy</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Your exact address is never shared with event organizers</li>
              <li>• Only approximate distances are calculated for event discovery</li>
              <li>• Location data is encrypted and stored securely</li>
            </ul>
          </div>

          <button
            onClick={handleUpdateLocation}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Update Location
          </button>
        </div>
      </div>
    </div>
  );
}