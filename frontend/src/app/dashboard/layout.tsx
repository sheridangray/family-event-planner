import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MobileNavigation } from "@/components/navigation/mobile-navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="pb-16">
        {children}
      </main>

      {/* Bottom Navigation - Mobile First */}
      <MobileNavigation />
    </div>
  );
}