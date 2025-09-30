"use client";

import { useEffect, useState } from 'react';

export default function OAuthCallback() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse URL parameters on client side only
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');
    const authError = urlParams.get('error');
    const state = urlParams.get('state');

    setCode(authCode);
    setError(authError);
    setLoading(false);

    console.log('OAuth callback received:', { code: authCode?.substring(0, 20) + '...', error: authError, state });

    if (authError) {
      console.error('OAuth callback error:', authError);
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth_error',
          error: authError
        }, window.location.origin);
      }
      return;
    }

    if (authCode) {
      console.log('Sending OAuth code to parent window');
      // Send success code to parent window
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth_success',
          code: authCode
        }, window.location.origin);
      }
    } else {
      console.error('No authorization code received');
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth_error',
          error: 'No authorization code received'
        }, window.location.origin);
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h1 className="mt-3 text-lg font-medium text-gray-900">Processing OAuth...</h1>
            <p className="mt-2 text-sm text-gray-600">Please wait while we process your authentication.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow rounded-lg p-6">
        {error ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-3 text-lg font-medium text-gray-900">Authentication Error</h1>
            <p className="mt-2 text-sm text-gray-600">Error: {error}</p>
            <button
              onClick={() => window.close()}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Close Window
            </button>
          </div>
        ) : code ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-3 text-lg font-medium text-gray-900">✅ Authentication Successful!</h1>
            <p className="mt-2 text-sm text-gray-600">
              Your account is being authenticated. This window will close automatically.
            </p>
            <div className="mt-4 text-xs text-gray-500">
              Authorization code received and sent to parent window.
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 13.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="mt-3 text-lg font-medium text-gray-900">Processing...</h1>
            <p className="mt-2 text-sm text-gray-600">
              Waiting for OAuth response...
            </p>
          </div>
        )}

        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-close after 3 seconds for success case
              if (${!!code}) {
                setTimeout(() => {
                  window.close();
                }, 3000);
              }
            `
          }}
        />
      </div>
    </div>
  );
}