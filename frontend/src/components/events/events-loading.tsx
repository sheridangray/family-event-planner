"use client";

export function EventsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Loading skeleton for bulk actions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-300 rounded w-32"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-300 rounded w-20"></div>
            <div className="h-8 bg-gray-300 rounded w-20"></div>
            <div className="h-8 bg-gray-300 rounded w-16"></div>
          </div>
        </div>
      </div>

      {/* Loading skeleton for smart suggestions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-40 mb-2"></div>
        <div className="space-y-2">
          <div className="h-4 bg-blue-200 rounded w-64"></div>
          <div className="h-4 bg-blue-200 rounded w-56"></div>
        </div>
      </div>

      {/* Loading skeleton for event cards */}
      <div className="space-y-4">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg border-2 border-gray-200 shadow-sm animate-pulse">
            <div className="p-4">
              {/* Header skeleton */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3">
                  <div className="h-5 w-5 bg-gray-300 rounded-full mt-1"></div>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-300 rounded w-3/4 mb-1"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="h-6 bg-gray-300 rounded-full w-20"></div>
              </div>

              {/* Location and Cost skeleton */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex items-start">
                  <div className="h-4 w-4 bg-gray-300 rounded mt-0.5 mr-2"></div>
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-24 mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded w-16"></div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="h-4 w-4 bg-gray-300 rounded mr-2"></div>
                  <div>
                    <div className="h-4 bg-gray-300 rounded w-16 mb-1"></div>
                    <div className="h-3 bg-gray-300 rounded w-20"></div>
                  </div>
                </div>
              </div>

              {/* Social proof skeleton */}
              <div className="flex items-center space-x-4 mb-3">
                <div className="flex items-center">
                  <div className="h-4 w-4 bg-gray-300 rounded mr-1"></div>
                  <div className="h-4 bg-gray-300 rounded w-16"></div>
                </div>
                <div className="flex space-x-1">
                  <div className="h-6 bg-gray-300 rounded w-16"></div>
                  <div className="h-6 bg-gray-300 rounded w-20"></div>
                </div>
              </div>

              {/* Action buttons skeleton */}
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-300 rounded w-16"></div>
                <div className="flex space-x-2">
                  <div className="h-8 bg-gray-300 rounded w-16"></div>
                  <div className="h-8 bg-gray-300 rounded w-20"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading skeleton for load more button */}
      <div className="text-center mt-6">
        <div className="h-10 bg-gray-300 rounded-lg w-32 mx-auto animate-pulse"></div>
      </div>
    </div>
  );
}