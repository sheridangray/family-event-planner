import { SettingsHeader } from "@/components/settings/settings-header";
import { FamilyProfile } from "@/components/settings/family-profile";
import { EventPreferences } from "@/components/settings/event-preferences";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { LocationSettings } from "@/components/settings/location-settings";
import { ChildrenProfiles } from "@/components/settings/children-profiles";
import { AccountSettings } from "@/components/settings/account-settings";
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SettingsHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Family Profile */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-32"></div>}>
          <FamilyProfile />
        </Suspense>

        {/* Children Profiles */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-64"></div>}>
          <ChildrenProfiles />
        </Suspense>

        {/* Event Preferences */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-96"></div>}>
          <EventPreferences />
        </Suspense>

        {/* Location Settings */}
        <Suspense fallback={<div className="animate-pulse bg-white rounded-lg h-48"></div>}>
          <LocationSettings />
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