import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    // Get the backend API URL
    const backendUrl = process.env.BACKEND_API_URL || 'https://family-event-planner-backend.onrender.com';
    const triggerUrl = `${backendUrl}/api/chatgpt-event-discoveries/trigger`;

    // Forward the request to the backend
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHATGPT_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: data.error || 'Failed to trigger discovery job'
      }, { status: response.status });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error triggering discovery job:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
