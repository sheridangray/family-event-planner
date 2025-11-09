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
    
    console.log('[Health Today] Email:', session.user.email);
    console.log('[Health Today] Backend URL:', backendUrl);
    console.log('[Health Today] API Key set:', !!apiKey);
    
    // Get user ID from email
    const userUrl = `${backendUrl}/api/family/user-by-email?email=${encodeURIComponent(session.user.email)}`;
    console.log('[Health Today] Fetching user from:', userUrl);
    
    const userResponse = await fetch(userUrl, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[Health Today] User fetch failed:', userResponse.status, errorText);
      throw new Error(`Failed to fetch user: ${userResponse.status} ${errorText}`);
    }

    const userData = await userResponse.json();
    console.log('[Health Today] User data:', userData);
    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("User ID not found in response");
    }

    // Fetch today's health data
    const healthUrl = `${backendUrl}/api/health/today/${userId}`;
    console.log('[Health Today] Fetching health from:', healthUrl);
    
    const response = await fetch(healthUrl, {
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Health Today] Health fetch failed:', response.status, errorText);
      throw new Error(`Failed to fetch health data: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Health Today] Success, data:', JSON.stringify(data).substring(0, 200));
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Health Today] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch health data",
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
