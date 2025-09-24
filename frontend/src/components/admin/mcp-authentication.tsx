"use client";

import { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ArrowPathIcon,
  KeyIcon 
} from '@heroicons/react/24/outline';

interface MCPServiceStatus {
  email: string;
  authenticated: boolean;
  lastAuthenticated?: string;
  scopes: string[];
  error?: string;
}

interface MCPAuthResponse {
  authUrl: string;
  email: string;
  scopes: string[];
}

export function MCPAuthenticationPanel() {
  const [services, setServices] = useState<MCPServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState('');
  const [showAuthInput, setShowAuthInput] = useState<string | null>(null);
  const [pendingAuth, setPendingAuth] = useState<MCPAuthResponse | null>(null);

  useEffect(() => {
    fetchServiceStatus();
  }, []);

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch('/api/admin/mcp-status');
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Failed to fetch MCP service status:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAuthentication = async (email: string) => {
    setAuthenticating(email);
    try {
      const response = await fetch('/api/admin/mcp-auth-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        const authData: MCPAuthResponse = await response.json();
        setPendingAuth(authData);
        setShowAuthInput(email);
        
        // Open auth URL in new window
        window.open(authData.authUrl, '_blank', 'width=600,height=700');
      } else {
        const error = await response.text();
        console.error('Authentication start failed:', error);
      }
    } catch (error) {
      console.error('Authentication request failed:', error);
    } finally {
      setAuthenticating(null);
    }
  };

  const completeAuthentication = async () => {
    if (!pendingAuth || !authCode.trim()) return;

    setAuthenticating(pendingAuth.email);
    try {
      const response = await fetch('/api/admin/mcp-auth-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingAuth.email,
          authCode: authCode.trim()
        })
      });

      if (response.ok) {
        setAuthCode('');
        setShowAuthInput(null);
        setPendingAuth(null);
        await fetchServiceStatus(); // Refresh status
      } else {
        const error = await response.text();
        console.error('Authentication completion failed:', error);
      }
    } catch (error) {
      console.error('Authentication completion request failed:', error);
    } finally {
      setAuthenticating(null);
    }
  };

  const cancelAuthentication = () => {
    setAuthCode('');
    setShowAuthInput(null);
    setPendingAuth(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
          <span className="ml-2 text-gray-600">Loading MCP service status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => (
          <div key={service.email} className="bg-white rounded-lg shadow border">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <KeyIcon className="h-6 w-6 text-gray-400 mr-2" />
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {service.email}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Gmail & Calendar Access
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  {service.authenticated ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={service.authenticated ? 'text-green-600' : 'text-red-600'}>
                    {service.authenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
                {service.lastAuthenticated && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Auth:</span>
                    <span className="text-gray-900">
                      {new Date(service.lastAuthenticated).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Scopes:</span>
                  <span className="text-gray-900 text-xs">
                    {service.scopes.length} permissions
                  </span>
                </div>
              </div>

              {service.error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-400 mt-0.5 mr-2" />
                    <div className="text-sm text-red-700">{service.error}</div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => startAuthentication(service.email)}
                  disabled={authenticating === service.email}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {authenticating === service.email ? (
                    <div className="flex items-center justify-center">
                      <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </div>
                  ) : (
                    service.authenticated ? 'Re-authenticate' : 'Authenticate'
                  )}
                </button>
                
                <button
                  onClick={() => fetchServiceStatus()}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Authentication Code Input */}
      {showAuthInput && (
        <div className="bg-white rounded-lg shadow border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Complete Authentication for {showAuthInput}
          </h3>
          
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
                disabled={!authCode.trim() || authenticating === showAuthInput}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authenticating === showAuthInput ? 'Completing...' : 'Complete Authentication'}
              </button>
              
              <button
                onClick={cancelAuthentication}
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
        <h4 className="text-sm font-medium text-blue-800 mb-2">How to authenticate:</h4>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Click "Authenticate" for the email account you want to set up</li>
          <li>A popup window will open with Google's OAuth consent screen</li>
          <li>Grant the requested permissions for Gmail and Calendar access</li>
          <li>Copy the authorization code from the success page</li>
          <li>Paste it in the input field and click "Complete Authentication"</li>
        </ol>
      </div>
    </div>
  );
}