"use client";

import { useState } from "react";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

interface Child {
  id: string;
  name: string;
  birthDate: string;
  interests: string[];
  specialNeeds?: string;
}

export function ChildrenProfiles() {
  const [children, setChildren] = useState<Child[]>([
    {
      id: "1",
      name: "Emma",
      birthDate: "2020-03-15",
      interests: ["Art", "Music", "Animals"],
      specialNeeds: "",
    },
    {
      id: "2", 
      name: "Liam",
      birthDate: "2022-08-22",
      interests: ["Science", "Building", "Outdoor Play"],
      specialNeeds: "Food allergies: nuts, dairy",
    }
  ]);
  
  const [editingChild, setEditingChild] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const getAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const availableInterests = [
    "Art", "Music", "Science", "Sports", "Reading", "Animals", "Cooking", 
    "Building", "Outdoor Play", "Dance", "Theater", "Technology", "Gardening"
  ];

  const handleAddChild = () => {
    setShowAddForm(true);
  };

  const handleSaveChild = (childData: Partial<Child>) => {
    // TODO: Save to backend
    if (editingChild) {
      setChildren(prev => prev.map(child => 
        child.id === editingChild ? {...child, ...childData} : child
      ));
      setEditingChild(null);
    } else {
      const newChild: Child = {
        id: Date.now().toString(),
        name: childData.name || "",
        birthDate: childData.birthDate || "",
        interests: childData.interests || [],
        specialNeeds: childData.specialNeeds || "",
      };
      setChildren(prev => [...prev, newChild]);
      setShowAddForm(false);
    }
  };

  const handleDeleteChild = (childId: string) => {
    setChildren(prev => prev.filter(child => child.id !== childId));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">👶 Children's Profiles</h3>
          <button
            onClick={handleAddChild}
            className="flex items-center px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Child
          </button>
        </div>

        <div className="space-y-4">
          {children.map((child) => (
            <div key={child.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{child.name}</h4>
                  <p className="text-sm text-gray-600">
                    {getAge(child.birthDate)} years old • Born {new Date(child.birthDate).toLocaleDateString()}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Add/Edit Child Form */}
        {(showAddForm || editingChild) && (
          <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-md font-medium text-gray-900 mb-3">
              {editingChild ? 'Edit Child' : 'Add New Child'}
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interests
                </label>
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {availableInterests.map((interest) => (
                    <label key={interest} className="flex items-center text-sm">
                      <input
                        type="checkbox"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Allergies, accessibility needs, behavioral considerations..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingChild(null);
                }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveChild({})}
                className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {editingChild ? 'Save Changes' : 'Add Child'}
              </button>
            </div>
          </div>
        )}

        {children.length === 0 && !showAddForm && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👶</div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">No children added yet</h4>
            <p className="text-xs text-gray-500 mb-4">
              Add your children's profiles to get personalized event recommendations
            </p>
            <button
              onClick={handleAddChild}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
            >
              Add Your First Child
            </button>
          </div>
        )}
      </div>
    </div>
  );
}