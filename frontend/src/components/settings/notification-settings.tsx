"use client";

import { useState } from "react";

export function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    email: {
      newEvents: true,
      eventReminders: true,
      registrationConfirm: true,
      weeklyDigest: true,
    },
    timing: {
      eventReminder24h: true,
      eventReminder1h: false,
      weeklyDigestDay: 'sunday',
    },
    frequency: {
      maxPerDay: 5,
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '08:00',
      }
    }
  });

  const handleSave = () => {
    // TODO: Save to backend
    console.log('Saving notification settings:', notifications);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">🔔 Notification Settings</h3>
        
        <div className="space-y-6">
          {/* Email Notifications */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Email Notifications</h4>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">New event discoveries</span>
                  <p className="text-xs text-gray-500">Get notified when new events are found</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email.newEvents}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    email: { ...prev.email, newEvents: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Event reminders</span>
                  <p className="text-xs text-gray-500">Reminders before registered events</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email.eventReminders}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    email: { ...prev.email, eventReminders: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Registration confirmations</span>
                  <p className="text-xs text-gray-500">Confirmation when events are registered</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email.registrationConfirm}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    email: { ...prev.email, registrationConfirm: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Weekly digest</span>
                  <p className="text-xs text-gray-500">Summary of upcoming events and activity</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.email.weeklyDigest}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    email: { ...prev.email, weeklyDigest: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          {/* Reminder Timing */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Reminder Timing</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={notifications.timing.eventReminder24h}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    timing: { ...prev.timing, eventReminder24h: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                />
                <span className="text-sm text-gray-700">24 hours before events</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={notifications.timing.eventReminder1h}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    timing: { ...prev.timing, eventReminder1h: e.target.checked }
                  }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                />
                <span className="text-sm text-gray-700">1 hour before events</span>
              </label>
            </div>
            
            {notifications.email.weeklyDigest && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weekly digest day
                </label>
                <select
                  value={notifications.timing.weeklyDigestDay}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    timing: { ...prev.timing, weeklyDigestDay: e.target.value }
                  }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                  <option value="friday">Friday</option>
                </select>
              </div>
            )}
          </div>

          {/* Frequency Limits */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Frequency Limits</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum emails per day
                </label>
                <select
                  value={notifications.frequency.maxPerDay}
                  onChange={(e) => setNotifications(prev => ({
                    ...prev,
                    frequency: { ...prev.frequency, maxPerDay: parseInt(e.target.value) }
                  }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1}>1 email per day</option>
                  <option value={3}>3 emails per day</option>
                  <option value={5}>5 emails per day</option>
                  <option value={10}>10 emails per day</option>
                </select>
              </div>

              <div>
                <label className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    checked={notifications.frequency.quietHours.enabled}
                    onChange={(e) => setNotifications(prev => ({
                      ...prev,
                      frequency: {
                        ...prev.frequency,
                        quietHours: { ...prev.frequency.quietHours, enabled: e.target.checked }
                      }
                    }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Quiet hours</span>
                </label>
                
                {notifications.frequency.quietHours.enabled && (
                  <div className="ml-6 flex items-center space-x-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">From</label>
                      <input
                        type="time"
                        value={notifications.frequency.quietHours.start}
                        onChange={(e) => setNotifications(prev => ({
                          ...prev,
                          frequency: {
                            ...prev.frequency,
                            quietHours: { ...prev.frequency.quietHours, start: e.target.value }
                          }
                        }))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">To</label>
                      <input
                        type="time"
                        value={notifications.frequency.quietHours.end}
                        onChange={(e) => setNotifications(prev => ({
                          ...prev,
                          frequency: {
                            ...prev.frequency,
                            quietHours: { ...prev.frequency.quietHours, end: e.target.value }
                          }
                        }))}
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}