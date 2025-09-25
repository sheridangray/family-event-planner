"use client";

import { useState, useEffect } from "react";
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon } from "@heroicons/react/24/outline";

interface Child {
  id: number;
  name: string;
  birthDate: string;
  age: number;
  interests: string[];
  specialNeeds: string;
  active: boolean;
}

interface FamilyContact {
  id: number;
  contactType: string;
  name: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  userId?: number;
  userRole?: string;
}

interface FamilySettings {
  family_name?: { value: string };
  home_address?: { value: string };
  home_city?: { value: string };
  home_state?: { value: string };
  home_zip?: { value: string };
}

export function ConsolidatedFamilyProfile() {
  const [familySettings, setFamilySettings] = useState<FamilySettings>({});
  const [children, setChildren] = useState<Child[]>([]);
  const [contacts, setContacts] = useState<FamilyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChild, setEditingChild] = useState<number | null>(null);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChild, setNewChild] = useState({
    name: '',
    birthDate: '',
    interests: [] as string[],
    specialNeeds: ''
  });

  const availableInterests = [
    "Art", "Music", "Science", "Sports", "Reading", "Animals", "Cooking", 
    "Building", "Outdoor Play", "Dance", "Theater", "Technology", "Gardening"
  ];

  useEffect(() => {
    fetchFamilyData();
  }, []);

  const fetchFamilyData = async () => {
    try {
      setLoading(true);
      
      // Fetch family settings, children, and contacts in parallel
      const [settingsRes, childrenRes, contactsRes] = await Promise.all([
        fetch('/api/family/settings', { 
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/family/children', { 
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch('/api/family/contacts', { 
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setFamilySettings(settingsData.settings || {});
      }

      if (childrenRes.ok) {
        const childrenData = await childrenRes.json();
        setChildren(childrenData.children || []);
      }

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.contacts || []);
      }

    } catch (error) {
      console.error('Failed to fetch family data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChild = async () => {
    if (!newChild.name || !newChild.birthDate) return;

    try {
      const response = await fetch('/api/family/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChild.name,
          birthDate: newChild.birthDate,
          interests: newChild.interests,
          specialNeeds: newChild.specialNeeds
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChildren([...children, data.child]);
        setNewChild({ name: '', birthDate: '', interests: [], specialNeeds: '' });
        setShowAddChild(false);
      }
    } catch (error) {
      console.error('Failed to add child:', error);
    }
  };

  const handleUpdateChild = async (childId: number, updates: Partial<Child>) => {
    try {
      const response = await fetch(`/api/family/children/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(children.map(child => 
          child.id === childId ? data.child : child
        ));
        setEditingChild(null);
      }
    } catch (error) {
      console.error('Failed to update child:', error);
    }
  };

  const handleDeleteChild = async (childId: number) => {
    try {
      const response = await fetch(`/api/family/children/${childId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setChildren(children.filter(child => child.id !== childId));
      }
    } catch (error) {
      console.error('Failed to delete child:', error);
    }
  };

  const toggleChildInterest = (interest: string) => {
    setNewChild(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
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
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const parents = contacts.filter(c => c.contactType === 'parent');
  const primaryParent = parents.find(p => p.isPrimary);
  const secondaryParent = parents.find(p => !p.isPrimary);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <UserGroupIcon className="h-6 w-6 mr-2 text-indigo-600" />
            {familySettings.family_name?.value || 'Family Profile'}
          </h3>
        </div>

        {/* Family Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <h4 className="text-lg font-medium text-gray-900 mb-3">👨‍👩‍👧‍👦 Parents</h4>
            <div className="space-y-3">
              {primaryParent && (
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{primaryParent.name} (Primary)</p>
                    <p className="text-sm text-gray-600">{primaryParent.email}</p>
                    {primaryParent.userRole && (
                      <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full mt-1">
                        {primaryParent.userRole}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {primaryParent.userId ? (
                      <span className="text-sm text-green-600">✅ Authenticated</span>
                    ) : (
                      <span className="text-sm text-gray-500">Not linked</span>
                    )}
                  </div>
                </div>
              )}
              
              {secondaryParent && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{secondaryParent.name}</p>
                    <p className="text-sm text-gray-600">{secondaryParent.email}</p>
                    {secondaryParent.userRole && (
                      <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full mt-1">
                        {secondaryParent.userRole}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    {secondaryParent.userId ? (
                      <span className="text-sm text-green-600">✅ Authenticated</span>
                    ) : (
                      <span className="text-sm text-gray-500">Not linked</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-3">📍 Location</h4>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-900">
                {familySettings.home_city?.value}, {familySettings.home_state?.value} {familySettings.home_zip?.value}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Used for event distance calculations
              </p>
            </div>
          </div>
        </div>

        {/* Children Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">👶 Children</h4>
            <button
              onClick={() => setShowAddChild(true)}
              className="flex items-center px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Child
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((child) => (
              <div key={child.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="text-lg font-medium text-gray-900">{child.name}</h5>
                    <p className="text-sm text-gray-600">
                      {child.age} years old • Born {new Date(child.birthDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingChild(child.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteChild(child.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interests
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {child.interests.map((interest, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  {child.specialNeeds && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Special Needs / Notes
                      </label>
                      <p className="text-sm text-gray-900 bg-yellow-50 border border-yellow-200 rounded p-2">
                        ⚠️ {child.specialNeeds}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Child Form */}
          {showAddChild && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h5 className="text-md font-medium text-gray-900 mb-3">Add New Child</h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newChild.name}
                    onChange={(e) => setNewChild({...newChild, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Child's name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={newChild.birthDate}
                    onChange={(e) => setNewChild({...newChild, birthDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interests
                  </label>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {availableInterests.map((interest) => (
                      <label key={interest} className="flex items-center text-sm">
                        <input
                          type="checkbox"
                          checked={newChild.interests.includes(interest)}
                          onChange={() => toggleChildInterest(interest)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-2"
                        />
                        {interest}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Needs / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={newChild.specialNeeds}
                    onChange={(e) => setNewChild({...newChild, specialNeeds: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Allergies, accessibility needs, behavioral considerations..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowAddChild(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddChild}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Add Child
                </button>
              </div>
            </div>
          )}

          {children.length === 0 && !showAddChild && (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">👶</div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">No children added yet</h4>
              <p className="text-xs text-gray-500 mb-4">
                Add your children's profiles to get personalized event recommendations
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}