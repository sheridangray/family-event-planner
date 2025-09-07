"use client";

import { useState } from "react";
import { PlayIcon, PauseIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

export function AutomationHeader() {
  const [isGlobalAutomationEnabled, setIsGlobalAutomationEnabled] = useState(true);

  const toggleGlobalAutomation = () => {
    setIsGlobalAutomationEnabled(!isGlobalAutomationEnabled);
    // TODO: Update backend
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🤖 Automation Control</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage automated event discovery and registration rules
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isGlobalAutomationEnabled 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {isGlobalAutomationEnabled ? '✓ Active' : '⏸ Paused'}
              </span>
            </div>
            
            <button
              onClick={toggleGlobalAutomation}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                isGlobalAutomationEnabled
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isGlobalAutomationEnabled ? (
                <>
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Pause All
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Resume All
                </>
              )}
            </button>
            
            <button className="flex items-center px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800">
              <Cog6ToothIcon className="h-4 w-4 mr-1" />
              Configure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}