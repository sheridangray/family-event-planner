"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  KeyIcon 
} from '@heroicons/react/24/outline';

interface UserOAuthStatus {
  email: string;
  authenticated: boolean;
  lastAuthenticated?: string;
  error?: string;
}

export function UserOAuthPanel() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<UserOAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showAuthInput, setShowAuthInput] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.email) {
      fetchAuthStatus();
    }
  }, [session]);

  const fetchAuthStatus = async () => {
    if (!session?.user?.email) return;
    
    try {
      const response = await fetch(`/api/auth/user-status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status || { 
          email: session.user.email, 
          authenticated: false,
          error: 'Unable to load status'
        });
      } else {
        console.error('Failed to fetch OAuth status:', response.statusText);
        setStatus({ 
          email: session.user.email, 
          authenticated: false,
          error: `API error: ${response.statusText}`
        });
      }
    } catch (error) {
      console.error('Failed to fetch OAuth status:', error);
      setStatus({ 
        email: session.user.email, 
        authenticated: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const startAuthentication = async () => {
    if (!session?.user?.email) return;
    
    setAuthenticating(true);
    try {
      const response = await fetch('/api/auth/oauth-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const authData = await response.json();
        setAuthUrl(authData.authUrl);
        setShowAuthInput(true);
        
        // Open auth URL in new window
        window.open(authData.authUrl, '_blank', 'width=600,height=700');
      } else {
        const error = await response.text();
        console.error('Authentication start failed:', error);
      }
    } catch (error) {
      console.error('Authentication request failed:', error);
    } finally {
      setAuthenticating(false);
    }
  };

  const completeAuthentication = async () => {
    if (!session?.user?.email || !authCode.trim()) return;

    setAuthenticating(true);
    try {
      const response = await fetch('/api/auth/oauth-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authCode: authCode.trim()
        })
      });

      if (response.ok) {
        setAuthCode('');
        setShowAuthInput(false);
        setAuthUrl(null);
        await fetchAuthStatus(); // Refresh status
      } else {
        const error = await response.text();
        console.error('Authentication completion failed:', error);
      }
    } catch (error) {
      console.error('Authentication completion request failed:', error);
    } finally {
      setAuthenticating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600">Loading authentication status...</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Unable to load authentication status.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">🔐 Email & Calendar Access</h2>
        <p className="text-sm text-gray-600 mt-1">
          Authenticate your Google account to receive email notifications and calendar conflict detection
        </p>
      </div>
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <KeyIcon className="h-6 w-6 text-gray-400 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {status.email}
              </h3>
              <p className="text-sm text-gray-500">
                Gmail & Calendar Integration
              </p>
            </div>
          </div>
          <div className="flex items-center">
            {status.authenticated ? (
              <div className="flex items-center text-green-600">
                <CheckCircleIcon className="h-6 w-6 mr-2" />
                <span className="font-medium">Authenticated</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <XCircleIcon className="h-6 w-6 mr-2" />
                <span className="font-medium">Not Authenticated</span>
              </div>
            )}
          </div>
        </div>

        {status.lastAuthenticated && (
          <div className="mb-4 text-sm text-gray-600">
            Last authenticated: {new Date(status.lastAuthenticated).toLocaleString()}
          </div>
        )}

        {status.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400 mt-0.5 mr-2" />
              <div className="text-sm text-red-700">{status.error}</div>
            </div>
          </div>
        )}

        {!status.authenticated && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400 mt-0.5 mr-2" />
              <div className="text-sm text-yellow-700">
                You need to authenticate to receive email notifications about family events and enable calendar conflict checking.
              </div>
            </div>
          </div>
        )}

        <div className="flex space-x-3 mb-6">
          <button
            onClick={startAuthentication}
            disabled={authenticating}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authenticating ? (
              <div className="flex items-center">
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </div>
            ) : (
              status.authenticated ? 'Re-authenticate' : 'Authenticate Google Account'
            )}
          </button>
          
          <button
            onClick={fetchAuthStatus}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh Status
          </button>
        </div>

        {/* Authentication Code Input */}
        {showAuthInput && (
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Complete Authentication
            </h4>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  After granting permissions in the popup window, paste the authorization code here:
                </p>
                <input
                  type="text"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  placeholder="Paste authorization code here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={completeAuthentication}
                  disabled={!authCode.trim() || authenticating}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authenticating ? 'Completing...' : 'Complete Authentication'}
                </button>
                
                <button
                  onClick={() => {
                    setShowAuthInput(false);
                    setAuthCode('');
                    setAuthUrl(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h5 className="text-sm font-medium text-blue-800 mb-2">Why authenticate?</h5>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Receive email notifications about family events that match your preferences</li>
            <li>Enable calendar conflict detection to avoid double-booking</li>
            <li>Allow the system to send event invitations on your behalf</li>
          </ul>
        </div>
      </div>
    </div>
  );
}