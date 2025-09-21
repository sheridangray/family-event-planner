// API client for Family Event Planner backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper function to make API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0
    );
  }
}

// Type definitions for API responses
export interface QuickStats {
  totalEvents: number;
  pendingReview: number;
  approved: number;
  registered: number;
  automationActive: boolean;
}

export interface TodayStats {
  discovered: string;
  approved: string;
  registered: string;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: {
    name: string;
    address: string;
    distance?: string;
  };
  cost: string; // API returns cost as string
  ageRange: {
    min: number;
    max: number;
  };
  status: 'discovered' | 'pending' | 'approved' | 'rejected' | 'registered' | 'manual_required';
  description: string;
  registrationUrl?: string;
  imageUrl?: string | null;
  socialProof?: {
    rating: string; // API returns rating as string
    reviewCount: number;
    tags: string[];
  };
  context?: {
    weather?: string | null;
    preferences?: string | null;
    urgency?: string | null;
  };
  source: string;
  autoRegistration?: string | null;
  confirmationNumber?: string | null;
  rejectionReason?: string | null;
  failureReason?: string | null;
  score?: string;
  createdAt: string;
  updatedAt: string;
  venue?: string; // Some events have venue instead of location.name
}

export interface SystemHealth {
  status: string;
  uptime: number;
  lastUpdate: string;
}

export interface DashboardData {
  quickStats: QuickStats;
  todayStats: TodayStats;
  pendingEvents: Event[];
  upcomingEvents: Event[];
  systemHealth: SystemHealth;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalEvents: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface EventsResponse {
  events: Event[];
  pagination: Pagination;
}

// API client methods
export const api = {
  // Dashboard data
  getDashboard: async (): Promise<DashboardData> => {
    const response = await apiRequest<{ success: boolean; data: DashboardData }>('/dashboard');
    return response.data;
  },

  // Events
  getEvents: async (params?: {
    status?: string;
    search?: string;
    venue?: string;
    cost?: string;
    age?: string;
    page?: string;
    limit?: string;
  }): Promise<EventsResponse> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value && value !== 'all') {
          searchParams.append(key, value);
        }
      });
    }
    const query = searchParams.toString();
    const response = await apiRequest<{ success: boolean; data: EventsResponse }>(`/events${query ? `?${query}` : ''}`);
    return response.data;
  },

  // Event actions
  approveEvent: (eventId: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/events/${eventId}/approve`, { method: 'POST' }),

  rejectEvent: (eventId: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/events/${eventId}/reject`, { method: 'POST' }),

  // Automation endpoints
  getAutomationStatus: (): Promise<any> =>
    apiRequest('/automation/status'),

  getDiscoveryProgress: (): Promise<any> =>
    apiRequest('/automation/discovery-progress'),

  runDiscovery: (): Promise<{ success: boolean; message: string; timestamp: string }> =>
    apiRequest('/automation/run-discovery', { method: 'POST' }),

  getScrapers: (timeRange?: string): Promise<any[]> => {
    const params = timeRange ? `?timeRange=${timeRange}` : '';
    return apiRequest(`/automation/scrapers${params}`);
  },

  toggleScraper: (scraperId: number): Promise<{ success: boolean; enabled: boolean; message: string }> =>
    apiRequest(`/automation/scrapers/${scraperId}/toggle`, { method: 'POST' }),

  runScraper: (scraperId: number): Promise<{ success: boolean; message: string; timestamp: string }> =>
    apiRequest(`/automation/scrapers/${scraperId}/run`, { method: 'POST' }),

  getAutomationActivity: (): Promise<any[]> =>
    apiRequest('/automation/activity'),

  getSystemHealth: (): Promise<any> =>
    apiRequest('/automation/health'),

  getAutomationRules: (): Promise<any[]> =>
    apiRequest('/automation/rules'),

  getScraperRuns: (limit?: number): Promise<any[]> => {
    const params = limit ? `?limit=${limit}` : '';
    return apiRequest(`/automation/scraper-runs${params}`);
  },

  getDiscoveryRunEvents: (runId: number): Promise<any[]> =>
    apiRequest(`/automation/discovery-run/${runId}/events`),

  getLatestDiscoveryRun: (): Promise<any> =>
    apiRequest('/automation/latest-discovery-run'),

  deleteScraper: (scraperId: number): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/automation/scrapers/${scraperId}`, { method: 'DELETE' }),

  submitScraperRequest: (domain: string, description?: string): Promise<{ success: boolean; message: string; requestId: number }> =>
    apiRequest('/automation/scraper-requests', {
      method: 'POST',
      body: JSON.stringify({ domain, description }),
    }),
};

export { ApiError };