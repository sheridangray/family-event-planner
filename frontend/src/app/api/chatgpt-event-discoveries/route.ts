import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

/**
 * GET /api/chatgpt-event-discoveries - List all discoveries
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '10';
    const offset = searchParams.get('offset') || '0';
    const targetDate = searchParams.get('targetDate') || '';

    // Build query string
    const queryParams = new URLSearchParams({
      limit,
      offset,
      ...(targetDate && { targetDate })
    });

    // Call backend API
    const response = await fetch(
      `${BACKEND_API_URL}/api/chatgpt-event-discoveries?${queryParams}`,
      {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      console.error('[ChatGPT Discoveries] Backend error:', errorText);
      return NextResponse.json({ 
        success: false,
        error: errorText 
      }, { status: response.status });
    }

  } catch (error) {
    console.error('[ChatGPT Discoveries] API error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

