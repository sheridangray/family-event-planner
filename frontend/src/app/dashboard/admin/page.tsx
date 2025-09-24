import { auth } from "@/auth";
import { MCPAuthenticationPanel } from "@/components/admin/mcp-authentication";

export default async function AdminPage() {
  const session = await auth();
  
  if (!session?.user) {
    return null;
  }

  // Only allow admin access for the main admin email
  const isAdmin = session.user.email === "sheridan.gray@gmail.com";
  
  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h1>
          <p className="text-red-700">
            This admin panel is restricted to system administrators only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⚙️ System Administration</h1>
        <p className="text-gray-600 mt-1">
          Manage MCP service authentication and system configuration
        </p>
      </div>

      {/* MCP Authentication Panel */}
      <MCPAuthenticationPanel />
    </div>
  );
}