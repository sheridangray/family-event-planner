"use client";

import { signOut } from "next-auth/react";
import { TrashIcon, ArrowRightOnRectangleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

export function AccountSettings() {
  const handleExportData = () => {
    // TODO: Export user data
    console.log('Exporting user data...');
  };

  const handleDeleteAccount = () => {
    // TODO: Delete account workflow
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      console.log('Deleting account...');
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">👤 Account & Privacy</h3>
        
        <div className="space-y-6">
          {/* Privacy Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <ShieldCheckIcon className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-green-900 mb-1">Privacy Protected</h4>
                <ul className="text-xs text-green-800 space-y-1">
                  <li>• Access restricted to authorized family members only</li>
                  <li>• Event data is encrypted and stored securely</li>
                  <li>• Location information is anonymized for event discovery</li>
                  <li>• No data is shared with third parties without consent</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Data Management</h4>
            <div className="space-y-3">
              <button
                onClick={handleExportData}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Export your data</div>
                    <div className="text-xs text-gray-500">Download all your family's event data and preferences</div>
                  </div>
                  <div className="text-indigo-600">→</div>
                </div>
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Account Actions</h4>
            <div className="space-y-3">
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                Sign Out
              </button>
              
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-center px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete Account
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              Deleting your account will permanently remove all family data, preferences, and event history. 
              This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}