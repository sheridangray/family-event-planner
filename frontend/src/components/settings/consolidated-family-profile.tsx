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
  const [editingChildData, setEditingChildData] = useState({
    name: '',
    birthDate: '',
    interests: [] as string[],
    specialNeeds: ''
  });
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

  const handleEditChild = (child: Child) => {
    setEditingChildData({
      name: child.name,
      birthDate: child.birthDate.split('T')[0], // Format for date input
      interests: [...child.interests],
      specialNeeds: child.specialNeeds
    });
    setEditingChild(child.id);
  };

  const handleUpdateChild = async () => {
    if (!editingChild || !editingChildData.name || !editingChildData.birthDate) return;

    try {
      const response = await fetch(`/api/family/children/${editingChild}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingChildData.name,
          birthDate: editingChildData.birthDate,
          interests: editingChildData.interests,
          specialNeeds: editingChildData.specialNeeds
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(children.map(child => 
          child.id === editingChild ? data.child : child
        ));
        setEditingChild(null);
        setEditingChildData({ name: '', birthDate: '', interests: [], specialNeeds: '' });
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

  const toggleEditingChildInterest = (interest: string) => {
    setEditingChildData(prev => ({
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
        <div className="mb-8">
          <h4 className="text-lg font-medium text-gray-900 mb-3">👨‍👩‍👧‍👦 Parents</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {primaryParent && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <h5 className="text-lg font-medium text-gray-900">{primaryParent.name} (Primary)</h5>
                  <p className="text-sm text-gray-600">{primaryParent.email}</p>
                </div>
                {primaryParent.userRole && (
                  <div>
                    <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                      {primaryParent.userRole}
                    </span>
                  </div>
                )}
              </div>
            )}

            {secondaryParent && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <h5 className="text-lg font-medium text-gray-900">{secondaryParent.name}</h5>
                  <p className="text-sm text-gray-600">{secondaryParent.email}</p>
                </div>
                {secondaryParent.userRole && (
                  <div>
                    <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                      {secondaryParent.userRole}
                    </span>
                  </div>
                )}
              </div>
            )}
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
                      onClick={() => handleEditChild(child)}
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

          {/* Add Child Modal */}
          {showAddChild && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowAddChild(false);
                  setNewChild({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto m-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Add New Child</h3>
                    <button
                      onClick={() => {
                        setShowAddChild(false);
                        setNewChild({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

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

                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setShowAddChild(false);
                        setNewChild({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                      }}
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
              </div>
            </div>
          )}

          {/* Edit Child Modal */}
          {editingChild && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setEditingChild(null);
                  setEditingChildData({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto m-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Edit Child Profile</h3>
                    <button
                      onClick={() => {
                        setEditingChild(null);
                        setEditingChildData({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editingChildData.name}
                        onChange={(e) => setEditingChildData({...editingChildData, name: e.target.value})}
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
                        value={editingChildData.birthDate}
                        onChange={(e) => setEditingChildData({...editingChildData, birthDate: e.target.value})}
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
                              checked={editingChildData.interests.includes(interest)}
                              onChange={() => toggleEditingChildInterest(interest)}
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
                        value={editingChildData.specialNeeds}
                        onChange={(e) => setEditingChildData({...editingChildData, specialNeeds: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Allergies, accessibility needs, behavioral considerations..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        setEditingChild(null);
                        setEditingChildData({ name: '', birthDate: '', interests: [], specialNeeds: '' });
                      }}
                      className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdateChild}
                      className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                      Update Child
                    </button>
                  </div>
                </div>
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