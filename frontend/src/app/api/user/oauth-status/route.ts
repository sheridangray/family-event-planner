import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

/**
 * User-specific OAuth status endpoint
 * Allows any authenticated user to check their own OAuth status
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    console.log(`[OAuth Status] Checking status for user: ${session.user.email}`);

    // Call backend to get user-specific authentication status
    const response = await fetch(`${BACKEND_API_URL}/api/admin/user-auth-status`, {
      headers: {
        'x-api-key': API_KEY,
        'x-user-email': session.user.email,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[OAuth Status] Backend response:`, data);
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      console.error(`[OAuth Status] Backend error:`, errorText);
      return NextResponse.json({ 
        success: false,
        error: errorText 
      }, { status: response.status });
    }

  } catch (error) {
    console.error('[OAuth Status] API error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
