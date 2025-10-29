import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

/**
 * PATCH /api/chatgpt-event-discoveries/:id/mark-interested - Mark event as interested
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Call backend API
    const response = await fetch(
      `${BACKEND_API_URL}/api/chatgpt-event-discoveries/${id}/mark-interested`,
      {
        method: 'PATCH',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      console.error('[ChatGPT Discovery Mark Interested] Backend error:', errorText);
      return NextResponse.json({ 
        success: false,
        error: errorText 
      }, { status: response.status });
    }

  } catch (error) {
    console.error('[ChatGPT Discovery Mark Interested] API error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

