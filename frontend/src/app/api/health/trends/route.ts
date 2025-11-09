import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const apiKey = process.env.API_KEY || '';
    
    console.log('[Health Trends] Email:', session.user.email);
    
    // Get user ID from email
    const userUrl = `${backendUrl}/api/family/user-by-email?email=${encodeURIComponent(session.user.email)}`;
    const userResponse = await fetch(userUrl, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Health Trends] User fetch failed:', userResponse.status, errorText);
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("User ID not found");
    }

    // Fetch weekly trends
    const trendsUrl = `${backendUrl}/api/health/trends/${userId}`;
    console.log('[Health Trends] Fetching from:', trendsUrl);
    
    const response = await fetch(trendsUrl, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Health Trends] Trends fetch failed:', response.status, errorText);
      throw new Error(`Failed to fetch trends: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Health Trends] Success');
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Health Trends] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch trends",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
