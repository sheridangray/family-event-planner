"use client";

import { useState } from "react";
import { PlusIcon, PlayIcon, PauseIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  conditions: string[];
  actions: string[];
  successCount: number;
  lastTriggered?: string;
}

export function RulesList() {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Auto-approve free SF Library events',
      description: 'Automatically approve all free events at SF Library locations',
      enabled: true,
      trigger: 'New event discovered',
      conditions: ['Venue: SF Library', 'Cost: Free', 'Age appropriate'],
      actions: ['Auto-approve', 'Set reminder', 'Send email'],
      successCount: 12,
      lastTriggered: '2 hours ago',
    },
    {
      id: '2',
      name: 'Auto-register for Cal Academy events under $25',
      description: 'Auto-register for California Academy events under $25 for kids',
      enabled: true,
      trigger: 'Event auto-approved',
      conditions: ['Venue: Cal Academy', 'Cost: < $25', 'Science category'],
      actions: ['Auto-register', 'Add to calendar', 'Send confirmation'],
      successCount: 5,
      lastTriggered: '1 day ago',
    },
    {
      id: '3',
      name: 'Weekend art events priority',
      description: 'Prioritize art events on weekends for family time',
      enabled: false,
      trigger: 'New weekend event',
      conditions: ['Category: Art', 'Time: Weekend', 'Family friendly'],
      actions: ['High priority approval', 'Send immediate notification'],
      successCount: 3,
      lastTriggered: '3 days ago',
    },
  ]);

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const deleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">⚙️ Automation Rules</h3>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <PlusIcon className="h-4 w-4 mr-2" />
            New Rule
          </button>
        </div>

        <div className="space-y-4">
          {rules.map((rule) => (
            <div 
              key={rule.id} 
              className={`border rounded-lg p-4 transition-colors ${
                rule.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <h4 className="text-md font-medium text-gray-900 mr-3">{rule.name}</h4>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      rule.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.enabled ? '✓ Active' : '⏸ Paused'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Trigger:</div>
                      <div className="text-gray-600">{rule.trigger}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Conditions:</div>
                      <div className="space-y-0.5">
                        {rule.conditions.map((condition, idx) => (
                          <div key={idx} className="text-gray-600">• {condition}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-700 mb-1">Actions:</div>
                      <div className="space-y-0.5">
                        {rule.actions.map((action, idx) => (
                          <div key={idx} className="text-gray-600">• {action}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled
                        ? 'text-red-600 hover:bg-red-100'
                        : 'text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {rule.enabled ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-200 text-xs">
                <div className="text-gray-600">
                  ✅ Successful triggers: <span className="font-medium">{rule.successCount}</span>
                </div>
                {rule.lastTriggered && (
                  <div className="text-gray-500">
                    Last triggered: {rule.lastTriggered}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {rules.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚙️</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No automation rules yet</h4>
            <p className="text-gray-600 mb-4">
              Create your first rule to start automating event discovery and registration
            </p>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Create Your First Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}