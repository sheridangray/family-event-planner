import { auth } from "@/auth";
import { SettingsHeader } from "@/components/settings/settings-header";
import { ConsolidatedFamilyProfile } from "@/components/settings/consolidated-family-profile";
import { EventPreferences } from "@/components/settings/event-preferences";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { EnhancedLocationSettings } from "@/components/settings/enhanced-location-settings";
import { AccountSettings } from "@/components/settings/account-settings";
import { UserOAuthPanel } from "@/components/settings/user-oauth-panel";
import { Suspense } from "react";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gray-50">
      <SettingsHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Consolidated Family & Children Profile */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
          <ConsolidatedFamilyProfile />
        </Suspense>

        {/* User OAuth Authentication - All Users */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-32"></div>}>
          <UserOAuthPanel />
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
      </div>
    </div>
  );
}