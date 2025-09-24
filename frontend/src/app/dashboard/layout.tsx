import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNavigation } from "@/components/navigation/top-navigation";

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
      {/* Top Navigation */}
      <TopNavigation user={session.user} />
      
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  );
}