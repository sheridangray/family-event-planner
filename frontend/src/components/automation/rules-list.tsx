"use client";

export function RulesList() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Discovery Preferences</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div>
            <div className="font-medium text-green-900">Age-Appropriate Filtering</div>
            <div className="text-xs text-green-700">Events scored based on children's ages</div>
          </div>
          <span className="text-green-600">✓ Active</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div>
            <div className="font-medium text-green-900">Schedule Compatibility</div>
            <div className="text-xs text-green-700">Prefers weekend events, avoids nap times</div>
          </div>
          <span className="text-green-600">✓ Active</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div>
            <div className="font-medium text-green-900">Budget Limits</div>
            <div className="text-xs text-green-700">Filters events over $50/person</div>
          </div>
          <span className="text-green-600">✓ Active</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div>
            <div className="font-medium text-green-900">Location Proximity</div>
            <div className="text-xs text-green-700">Within 25 miles of home</div>
          </div>
          <span className="text-green-600">✓ Active</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Preferences are learned from your event ratings. Use the iOS app to rate attended events.
        </p>
      </div>
    </div>
  );
}
