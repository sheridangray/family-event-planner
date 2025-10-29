import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

/**
 * GET /api/chatgpt-event-discoveries/:id - Get a single discovery
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { id } = params;

    // Call backend API
    const response = await fetch(
      `${BACKEND_API_URL}/api/chatgpt-event-discoveries/${id}`,
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
      console.error('[ChatGPT Discovery] Backend error:', errorText);
      return NextResponse.json({ 
        success: false,
        error: errorText 
      }, { status: response.status });
    }

  } catch (error) {
    console.error('[ChatGPT Discovery] API error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

