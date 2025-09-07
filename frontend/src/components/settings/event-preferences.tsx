"use client";

import { useState } from "react";

interface EventPreferences {
  eventTypes: string[];
  costRange: {
    min: number;
    max: number;
    freeOnly: boolean;
  };
  timePreferences: {
    weekdayEvening: boolean;
    weekendMorning: boolean;
    weekendAfternoon: boolean;
    earlyBird: boolean; // before 10am
    noLateNight: boolean; // after 7pm
  };
  autoApproval: {
    enabled: boolean;
    freeEventsOnly: boolean;
    maxCost: number;
    trustedVenues: boolean;
    familiarEventTypes: boolean;
  };
  discoveryRadius: number;
}

export function EventPreferences() {
  const [preferences, setPreferences] = useState<EventPreferences>({
    eventTypes: ["Art", "Science", "Educational", "Music"],
    costRange: {
      min: 0,
      max: 50,
      freeOnly: false,
    },
    timePreferences: {
      weekdayEvening: true,
      weekendMorning: true,
      weekendAfternoon: true,
      earlyBird: false,
      noLateNight: true,
    },
    autoApproval: {
      enabled: true,
      freeEventsOnly: true,
      maxCost: 25,
      trustedVenues: true,
      familiarEventTypes: true,
    },
    discoveryRadius: 20,
  });

  const eventTypeOptions = [
    "Art", "Science", "Music", "Sports", "Educational", "Outdoor", 
    "Theater", "Dance", "Cooking", "Technology", "Reading", "Animals"
  ];

  const handlePreferenceChange = (section: keyof EventPreferences, key: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      }
    }));
  };

  const handleSave = () => {
    // TODO: Save to backend
    console.log('Saving preferences:', preferences);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">🎯 Event Discovery Preferences</h3>
        </div>

        <div className="space-y-8">
          {/* Event Types */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Preferred Event Types</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {eventTypeOptions.map((type) => (
                <label key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.eventTypes.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked 
                        ? [...preferences.eventTypes, type]
                        : preferences.eventTypes.filter(t => t !== type);
                      setPreferences(prev => ({...prev, eventTypes: newTypes}));
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cost Preferences */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">💰 Cost Preferences</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={preferences.costRange.freeOnly}
                    onChange={(e) => handlePreferenceChange('costRange', 'freeOnly', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Free events only</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Cost per Event
                </label>
                <select
                  value={preferences.costRange.max}
                  onChange={(e) => handlePreferenceChange('costRange', 'max', parseInt(e.target.value))}
                  disabled={preferences.costRange.freeOnly}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                >
                  <option value={25}>$25</option>
                  <option value={50}>$50</option>
                  <option value={100}>$100</option>
                  <option value={200}>$200+</option>
                </select>
              </div>
            </div>
          </div>

          {/* Time Preferences */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">⏰ Time Preferences</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.timePreferences.weekdayEvening}
                    onChange={(e) => handlePreferenceChange('timePreferences', 'weekdayEvening', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Weekday evenings (after 5pm)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.timePreferences.weekendMorning}
                    onChange={(e) => handlePreferenceChange('timePreferences', 'weekendMorning', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Weekend mornings (9am-12pm)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.timePreferences.weekendAfternoon}
                    onChange={(e) => handlePreferenceChange('timePreferences', 'weekendAfternoon', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Weekend afternoons (12pm-5pm)</span>
                </label>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.timePreferences.earlyBird}
                    onChange={(e) => handlePreferenceChange('timePreferences', 'earlyBird', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Early events welcome (before 10am)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.timePreferences.noLateNight}
                    onChange={(e) => handlePreferenceChange('timePreferences', 'noLateNight', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">No late events (after 7pm)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Location Radius */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">📍 Discovery Radius</h4>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={preferences.discoveryRadius}
                onChange={(e) => setPreferences(prev => ({...prev, discoveryRadius: parseInt(e.target.value)}))}
                className="flex-1"
              />
              <span className="text-sm text-gray-700 min-w-[80px]">
                {preferences.discoveryRadius} miles
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Events will be discovered within this radius from your home location
            </p>
          </div>

          {/* Auto-Approval Settings */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">🤖 Auto-Approval Settings</h4>
            
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.autoApproval.enabled}
                  onChange={(e) => handlePreferenceChange('autoApproval', 'enabled', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Enable auto-approval for qualifying events</span>
                  <p className="text-xs text-gray-500">Events meeting your criteria will be automatically approved</p>
                </div>
              </label>
            </div>

            {preferences.autoApproval.enabled && (
              <div className="ml-6 space-y-3 bg-gray-50 rounded-lg p-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.autoApproval.freeEventsOnly}
                    onChange={(e) => handlePreferenceChange('autoApproval', 'freeEventsOnly', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Free events only</span>
                </label>
                
                {!preferences.autoApproval.freeEventsOnly && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum cost for auto-approval
                    </label>
                    <select
                      value={preferences.autoApproval.maxCost}
                      onChange={(e) => handlePreferenceChange('autoApproval', 'maxCost', parseInt(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={10}>$10</option>
                      <option value={25}>$25</option>
                      <option value={50}>$50</option>
                    </select>
                  </div>
                )}
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.autoApproval.trustedVenues}
                    onChange={(e) => handlePreferenceChange('autoApproval', 'trustedVenues', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Trusted venues only (Cal Academy, SF Library, etc.)</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.autoApproval.familiarEventTypes}
                    onChange={(e) => handlePreferenceChange('autoApproval', 'familiarEventTypes', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm text-gray-700">Familiar event types only</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}