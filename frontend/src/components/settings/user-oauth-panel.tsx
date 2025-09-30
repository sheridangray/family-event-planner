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
import { api } from '@/lib/api';

interface UserOAuthStatus {
  email: string;
  authenticated: boolean;
  lastAuthenticated?: string;
  error?: string;
}

export function UserOAuthPanel() {
  const { data: session } = useSession();
  const [allServices, setAllServices] = useState<UserOAuthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showAuthInput, setShowAuthInput] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Known parent emails
  const parentEmails = ['joyce.yan.zhang@gmail.com', 'sheridan.gray@gmail.com'];

  useEffect(() => {
    fetchAuthStatus();
  }, []);

  const fetchAuthStatus = async () => {
    console.log('[OAuth Status] Fetching authentication status...');
    
    try {
      const data = await api.getMcpStatus();
      console.log('[OAuth Status] MCP status response:', data);

      // Create a status entry for each parent email
      const parentStatuses = parentEmails.map(email => {
        const service = data.services?.find((service: any) => service.email === email);

        if (service) {
          return {
            email: service.email,
            authenticated: service.authenticated,
            lastAuthenticated: service.lastAuthenticated,
            error: service.error
          };
        } else {
          return {
            email,
            authenticated: false,
            error: 'MCP service not configured for this email'
          };
        }
      });

      console.log('[OAuth Status] Parsed statuses:', parentStatuses);
      setAllServices(parentStatuses);
    } catch (error) {
      console.error('[OAuth Status] Failed to fetch MCP status:', error);
      
      // Fallback: Try to get individual user status
      try {
        console.log('[OAuth Status] Trying fallback user-specific status...');
        const userStatus = await api.getUserOAuthStatus();
        console.log('[OAuth Status] User status response:', userStatus);
        
        if (userStatus.success && userStatus.status) {
          // Create status array with current user's status
          const statusArray = parentEmails.map(email => {
            if (email === session?.user?.email) {
              return userStatus.status;
            }
            return {
              email,
              authenticated: false,
              error: 'Unable to view other user status'
            };
          });
          
          console.log('[OAuth Status] Using fallback statuses:', statusArray);
          setAllServices(statusArray);
        } else {
          throw new Error('Fallback status check returned invalid data');
        }
      } catch (fallbackError) {
        console.error('[OAuth Status] Fallback status check also failed:', fallbackError);
        
        // Set error status for all parents
        setAllServices(parentEmails.map(email => ({
          email,
          authenticated: false,
          error: `Unable to fetch status: ${error instanceof Error ? error.message : 'Unknown error'}`
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const startAuthentication = async () => {
    if (!session?.user?.email) {
      console.error('[OAuth] Cannot start authentication: No user email in session');
      return;
    }

    console.log('[OAuth] Starting authentication flow for:', session.user.email);
    setAuthenticating(true);
    
    try {
      console.log('[OAuth] Requesting auth URL from backend...');
      const authData = await api.startMcpAuth(session.user.email);
      console.log('[OAuth] Auth URL received:', authData.authUrl ? 'Yes' : 'No');
      console.log('[OAuth] Required scopes:', authData.scopes);
      
      setAuthUrl(authData.authUrl);

      // Open auth URL in new window
      console.log('[OAuth] Opening authentication popup...');
      const authWindow = window.open(authData.authUrl, '_blank', 'width=600,height=700');

      if (!authWindow) {
        console.error('[OAuth] Failed to open popup window - popup blocker may be active');
        setAuthenticating(false);
        return;
      }

      // Listen for the OAuth callback message
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          console.warn('[OAuth] Ignoring message from different origin:', event.origin);
          return;
        }

        if (event.data?.type === 'oauth_success' && event.data?.code) {
          console.log('[OAuth] ✅ Received OAuth code from popup');
          console.log('[OAuth] Code length:', event.data.code.length);

          // Remove the message listener
          window.removeEventListener('message', handleMessage);

          // Automatically complete authentication with the received code
          await completeAuthenticationWithCode(event.data.code);

          // Close the popup if it's still open
          if (authWindow && !authWindow.closed) {
            console.log('[OAuth] Closing authentication popup');
            authWindow.close();
          }
        } else if (event.data?.type === 'oauth_error') {
          console.error('[OAuth] ❌ OAuth error from popup:', event.data.error);
          window.removeEventListener('message', handleMessage);
          setAuthenticating(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Cleanup listener if popup is closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          console.log('[OAuth] Popup closed by user');
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setAuthenticating(false);
        }
      }, 1000);
    } catch (error) {
      console.error('[OAuth] ❌ Authentication request failed:', error);
      if (error instanceof Error) {
        console.error('[OAuth] Error message:', error.message);
        console.error('[OAuth] Error stack:', error.stack);
      }
      setAuthenticating(false);
    }
  };

  const completeAuthenticationWithCode = async (code: string) => {
    if (!session?.user?.email) {
      console.error('[OAuth Complete] Cannot complete: No user email in session');
      return;
    }

    console.log('[OAuth Complete] Starting completion for:', session.user.email);
    console.log('[OAuth Complete] Authorization code length:', code.length);

    try {
      console.log('[OAuth Complete] Sending completion request to backend...');
      const result = await api.completeMcpAuth(session.user.email, code);
      
      console.log('[OAuth Complete] ✅ Backend response:', result);
      
      if (result.success) {
        console.log('[OAuth Complete] Authentication successful! User ID:', result.userId);
        console.log('[OAuth Complete] Refreshing authentication status...');
        
        // Give the backend a moment to save tokens
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await fetchAuthStatus();
        console.log('[OAuth Complete] ✅ Status refresh complete');
      } else {
        console.error('[OAuth Complete] ❌ Authentication failed:', result);
      }
    } catch (error) {
      console.error('[OAuth Complete] ❌ Completion request failed:', error);
      if (error instanceof Error) {
        console.error('[OAuth Complete] Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
    } finally {
      setAuthenticating(false);
      console.log('[OAuth Complete] Authentication flow finished');
    }
  };

  const completeAuthentication = async () => {
    if (!session?.user?.email || !authCode.trim()) return;

    setAuthenticating(true);
    await completeAuthenticationWithCode(authCode.trim());
    setAuthCode('');
    setShowAuthInput(false);
    setAuthUrl(null);
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

  const currentUserStatus = allServices.find(service => service.email === session?.user?.email);
  const allAuthenticated = allServices.every(service => service.authenticated);

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">🔐 Email & Calendar Access</h2>
        <p className="text-sm text-gray-600 mt-1">
          Authenticate your Google account to receive email notifications and calendar conflict detection
        </p>
      </div>

      <div className="p-6">
        {/* Parent Account Status Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {allServices.map((service) => {
            const isCurrentUser = service.email === session?.user?.email;
            const displayName = service.email === 'joyce.yan.zhang@gmail.com' ? 'Joyce' : 'Sheridan';

            return (
              <div key={service.email} className={`border rounded-lg p-4 ${isCurrentUser ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <KeyIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <h3 className="text-base font-medium text-gray-900">
                        {displayName}
                        {isCurrentUser && <span className="text-sm text-indigo-600 ml-2">(You)</span>}
                      </h3>
                      <p className="text-sm text-gray-500">{service.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {service.authenticated ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircleIcon className="h-5 w-5 mr-1" />
                        <span className="text-sm font-medium">Authenticated</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <XCircleIcon className="h-5 w-5 mr-1" />
                        <span className="text-sm font-medium">Not Authenticated</span>
                      </div>
                    )}
                  </div>
                </div>

                {service.lastAuthenticated && (
                  <div className="mb-3 text-xs text-gray-600">
                    Last authenticated: {new Date(service.lastAuthenticated).toLocaleDateString()}
                  </div>
                )}

                {service.error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-3">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-xs text-red-700">{service.error}</div>
                    </div>
                  </div>
                )}

                {/* Authentication buttons only for current user */}
                {isCurrentUser ? (
                  <div className="flex space-x-2">
                    <button
                      onClick={startAuthentication}
                      disabled={authenticating}
                      className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded-md text-xs font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {authenticating ? (
                        <div className="flex items-center justify-center">
                          <ArrowPathIcon className="h-3 w-3 animate-spin mr-1" />
                          Processing...
                        </div>
                      ) : (
                        service.authenticated ? 'Re-authenticate' : 'Authenticate'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic">
                    {service.authenticated ? 'Account connected' : `${displayName} needs to log in to authenticate`}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Global actions */}
        <div className="flex space-x-3 mb-6">
          <button
            onClick={fetchAuthStatus}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh Status
          </button>
        </div>

        {/* Overall status warning */}
        {!allAuthenticated && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400 mt-0.5 mr-2" />
              <div className="text-sm text-yellow-700">
                Email notifications and calendar integration require both parents to authenticate their accounts.
              </div>
            </div>
          </div>
        )}

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

      </div>
    </div>
  );
}