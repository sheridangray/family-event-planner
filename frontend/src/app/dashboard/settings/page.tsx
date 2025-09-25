import { auth } from "@/auth";
import { SettingsHeader } from "@/components/settings/settings-header";
import { ConsolidatedFamilyProfile } from "@/components/settings/consolidated-family-profile";
import { EventPreferences } from "@/components/settings/event-preferences";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { EnhancedLocationSettings } from "@/components/settings/enhanced-location-settings";
import { AccountSettings } from "@/components/settings/account-settings";
import { MCPAuthenticationPanel } from "@/components/admin/mcp-authentication";
import { UserOAuthPanel } from "@/components/settings/user-oauth-panel";
import { Suspense } from "react";

export default async function SettingsPage() {
  const session = await auth();
  const isAdmin = session?.user?.email === "sheridan.gray@gmail.com";

  return (
    <div className="min-h-screen bg-gray-50">
      <SettingsHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Consolidated Family & Children Profile */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
          <ConsolidatedFamilyProfile />
        </Suspense>

        {/* Event Preferences */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
          <EventPreferences />
        </Suspense>

        {/* Enhanced Location Settings */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-48"></div>}>
          <EnhancedLocationSettings />
        </Suspense>

        {/* Notification Settings */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-64"></div>}>
          <NotificationSettings />
        </Suspense>

        {/* Account Settings */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-32"></div>}>
          <AccountSettings />
        </Suspense>

        {/* User OAuth Authentication - All Users */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-32"></div>}>
          <UserOAuthPanel />
        </Suspense>

        {/* System Administration - Admin Only */}
        {isAdmin && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">⚙️ System Administration</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage MCP service authentication and system configuration
              </p>
            </div>
            <div className="p-6">
              <MCPAuthenticationPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}