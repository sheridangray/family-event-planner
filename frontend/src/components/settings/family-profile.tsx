"use client";

import { useState } from "react";
import { PencilIcon } from "@heroicons/react/24/outline";

export function FamilyProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const [familyData, setFamilyData] = useState({
    familyName: "Gray-Zhang Family",
    email: "sheridan.gray@gmail.com",
    secondaryEmail: "joyce.yan.zhang@gmail.com",
  });

  const handleSave = () => {
    // TODO: Save to backend
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">👨‍👩‍👧‍👦 Family Profile</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Family Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={familyData.familyName}
                onChange={(e) => setFamilyData({...familyData, familyName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <p className="text-gray-900 py-2">{familyData.familyName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Email
            </label>
            <p className="text-gray-900 py-2">{familyData.email}</p>
            <p className="text-xs text-gray-500">Connected via Google OAuth</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Email
            </label>
            <p className="text-gray-900 py-2">{familyData.secondaryEmail}</p>
            <p className="text-xs text-gray-500">Also receives notifications</p>
          </div>
        </div>

        {isEditing && (
          <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}