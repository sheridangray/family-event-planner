"use client";

import { useQuery } from "@tanstack/react-query";
import {
  HeartIcon,
  FireIcon,
  MoonIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { format, parseISO } from "date-fns";

interface HealthMetric {
  steps?: number;
  exercise_minutes?: number;
  sleep_hours?: number;
  weight_lbs?: number;
  resting_heart_rate?: number;
  updated_at?: string;
}

interface Progress {
  current: number;
  target: number;
  percentage: number;
  achieved: boolean;
}

interface TodaySummary {
  date: string;
  metrics: HealthMetric;
  goals: Record<string, number>;
  progress: Record<string, Progress>;
}

interface TrendData {
  metric_date: string;
  steps: number;
  exercise_minutes: number;
  sleep_hours: number;
  resting_heart_rate: number;
  weight_lbs: number;
}

export default function HealthPage() {
  const { data: todayData, isLoading: loadingToday } = useQuery({
    queryKey: ["health-today"],
    queryFn: async () => {
      const response = await fetch("/api/health/today");
      if (!response.ok) {
        return null; // Return null on error
      }
      const json = await response.json();
      return json.data as TodaySummary;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const { data: trendsData, isLoading: loadingTrends } = useQuery({
    queryKey: ["health-trends"],
    queryFn: async () => {
      const response = await fetch("/api/health/trends");
      if (!response.ok) {
        return []; // Return empty array on error
      }
      const json = await response.json();
      return (json.data || []) as TrendData[];
    },
  });

  if (loadingToday) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasData = todayData?.metrics && (todayData.metrics.steps || todayData.metrics.exercise_minutes || todayData.metrics.sleep_hours);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Physical Health</h1>
        <p className="text-gray-600 mt-2">
          Track your daily activity, sleep, and wellness metrics
        </p>
        {todayData?.metrics?.updated_at && (
          <p className="text-sm text-gray-500 mt-1">
            Last synced: {format(parseISO(todayData.metrics.updated_at), "MMM d 'at' h:mm a")}
          </p>
        )}
      </div>

      {!hasData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📱 Ready to sync your health data?
          </h3>
          <p className="text-blue-800 mb-4">
            Follow the instructions below to set up the iOS Shortcut and start tracking your health metrics.
          </p>
          <a
            href="#setup-instructions"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Setup Instructions
          </a>
        </div>
      )}

      {/* Today's Metrics Cards */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Steps"
            value={todayData?.metrics?.steps?.toLocaleString() || "0"}
            progress={todayData?.progress?.steps}
            icon={FireIcon}
            color="blue"
          />
          <MetricCard
            title="Exercise"
            value={`${todayData?.metrics?.exercise_minutes || 0} min`}
            progress={todayData?.progress?.exercise_minutes}
            icon={HeartIcon}
            color="red"
          />
          <MetricCard
            title="Sleep"
            value={`${todayData?.metrics?.sleep_hours ? Number(todayData.metrics.sleep_hours).toFixed(1) : 0}h`}
            progress={todayData?.progress?.sleep_hours}
            icon={MoonIcon}
            color="purple"
          />
          <MetricCard
            title="Heart Rate"
            value={todayData?.metrics?.resting_heart_rate ? `${todayData.metrics.resting_heart_rate} bpm` : "--"}
            icon={HeartIcon}
            color="pink"
          />
        </div>
      )}

      {/* Weekly Trends */}
      {trendsData && trendsData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <ArrowTrendingUpIcon className="h-6 w-6 mr-2 text-indigo-600" />
            Weekly Trends
          </h2>
          <WeeklyTrendsTable data={trendsData} />
        </div>
      )}

      {/* Setup Instructions */}
      <div id="setup-instructions" className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          iOS Shortcut Setup Instructions
        </h2>
        <SetupInstructions />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  progress,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  progress?: Progress;
  icon: any;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    pink: "bg-pink-50 text-pink-600",
    green: "bg-green-50 text-green-600",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="h-6 w-6" />
        </div>
        {progress?.achieved && (
          <CheckCircleIcon className="h-6 w-6 text-green-500" />
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      {progress && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{Number(progress.current).toLocaleString()}</span>
            <span>{Number(progress.target).toLocaleString()} goal</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                progress.achieved ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(100, Number(progress.percentage))}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyTrendsTable({ data }: { data: TrendData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Steps
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Exercise
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sleep
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Heart Rate
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((day) => (
            <tr key={day.metric_date} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">
                {format(parseISO(day.metric_date), "MMM d")}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {day.steps?.toLocaleString() || "--"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {day.exercise_minutes ? `${day.exercise_minutes} min` : "--"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {day.sleep_hours ? `${Number(day.sleep_hours).toFixed(1)}h` : "--"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {day.resting_heart_rate ? `${day.resting_heart_rate} bpm` : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SetupInstructions() {
  return (
    <div className="prose max-w-none">
      <ol className="space-y-4">
        <li className="text-gray-700">
          <strong>Open the Shortcuts app</strong> on your iPhone
        </li>
        <li className="text-gray-700">
          <strong>Create a new shortcut</strong> by tapping the "+" button
        </li>
        <li className="text-gray-700">
          <strong>Add the following actions:</strong>
          <ul className="mt-2 space-y-2">
            <li>Search for "Find Health Samples" and add it</li>
            <li>Configure it to get Steps, Exercise Minutes, Sleep Hours, Heart Rate</li>
            <li>Set the time period to "Last 1 Day"</li>
            <li>Add "Get Contents of URL" action</li>
            <li>Set URL to: <code className="bg-gray-100 px-2 py-1 rounded text-sm">
              {typeof window !== 'undefined' ? window.location.origin : 'YOUR_DOMAIN'}/api/health/sync
            </code></li>
            <li>Set Method to POST</li>
            <li>Add Request Body with your health data</li>
          </ul>
        </li>
        <li className="text-gray-700">
          <strong>Run the shortcut</strong> once manually to grant permissions
        </li>
        <li className="text-gray-700">
          <strong>(Optional) Set up automation</strong> to run daily at a specific time
        </li>
      </ol>
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> You'll need your API key and user ID. Contact support if you need help finding these values.
        </p>
      </div>
    </div>
  );
}
