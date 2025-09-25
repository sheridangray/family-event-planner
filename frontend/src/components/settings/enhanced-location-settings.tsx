"use client";

import { useState, useEffect } from "react";
import { MapPinIcon, PencilIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface LocationSettings {
  home_address?: { value: string };
  home_city?: { value: string };
  home_state?: { value: string };
  home_zip?: { value: string };
  home_country?: { value: string };
  max_distance_miles?: { value: number };
}

export function EnhancedLocationSettings() {
  const [settings, setSettings] = useState<LocationSettings>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    home_address: '',
    home_city: '',
    home_state: '',
    home_zip: '',
    home_country: '',
    max_distance_miles: 30
  });

  useEffect(() => {
    fetchLocationSettings();
  }, []);

  const fetchLocationSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/family/settings');
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
        
        // Initialize edit form with current values
        setEditForm({
          home_address: data.settings?.home_address?.value || '',
          home_city: data.settings?.home_city?.value || '',
          home_state: data.settings?.home_state?.value || '',
          home_zip: data.settings?.home_zip?.value || '',
          home_country: data.settings?.home_country?.value || 'US',
          max_distance_miles: data.settings?.max_distance_miles?.value || 30
        });
      }
    } catch (error) {
      console.error('Failed to fetch location settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await fetch('/api/family/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            home_address: { value: editForm.home_address, type: 'string' },
            home_city: { value: editForm.home_city, type: 'string' },
            home_state: { value: editForm.home_state, type: 'string' },
            home_zip: { value: editForm.home_zip, type: 'string' },
            home_country: { value: editForm.home_country, type: 'string' },
            max_distance_miles: { value: editForm.max_distance_miles, type: 'number' }
          }
        })
      });

      if (response.ok) {
        await fetchLocationSettings(); // Refresh data
        setEditing(false);
      } else {
        console.error('Failed to save location settings');
      }
    } catch (error) {
      console.error('Error saving location settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to current settings
    setEditForm({
      home_address: settings.home_address?.value || '',
      home_city: settings.home_city?.value || '',
      home_state: settings.home_state?.value || '',
      home_zip: settings.home_zip?.value || '',
      home_country: settings.home_country?.value || 'US',
      max_distance_miles: settings.max_distance_miles?.value || 30
    });
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentAddress = `${settings.home_city?.value || ''}, ${settings.home_state?.value || ''} ${settings.home_zip?.value || ''}`.trim();

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📍 Home Location</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <PencilIcon className="h-4 w-4 mr-1" />
              Edit
            </button>
          )}
        </div>
        
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={editForm.home_address}
                  onChange={(e) => setEditForm({...editForm, home_address: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={editForm.home_city}
                  onChange={(e) => setEditForm({...editForm, home_city: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="San Francisco"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={editForm.home_state}
                  onChange={(e) => setEditForm({...editForm, home_state: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="CA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={editForm.home_zip}
                  onChange={(e) => setEditForm({...editForm, home_zip: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="94158"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country
                </label>
                <select
                  value={editForm.home_country}
                  onChange={(e) => setEditForm({...editForm, home_country: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="UK">United Kingdom</option>
                  <option value="AU">Australia</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Distance (miles)
                </label>
                <input
                  type="number"
                  value={editForm.max_distance_miles}
                  onChange={(e) => setEditForm({...editForm, max_distance_miles: parseInt(e.target.value) || 30})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  min="1"
                  max="100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="flex items-center px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                <XMarkIcon className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Home Address
              </label>
              <div className="flex items-center">
                <MapPinIcon className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  {settings.home_address?.value && (
                    <span className="text-gray-900">{settings.home_address.value}, </span>
                  )}
                  <span className="text-gray-900">{currentAddress}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This location is used to calculate distances to events and for weather data
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Radius
              </label>
              <p className="text-gray-900">
                {settings.max_distance_miles?.value || 30} miles
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Maximum distance for event discovery
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-2">🌍 Location Privacy</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Your exact address is never shared with event organizers</li>
                <li>• Only approximate distances are calculated for event discovery</li>
                <li>• Location data is encrypted and stored securely</li>
                <li>• Used for weather data and travel time estimates</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}