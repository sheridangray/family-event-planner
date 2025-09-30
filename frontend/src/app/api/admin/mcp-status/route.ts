import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

export async function GET(req: NextRequest) {
  try {
    // Check authentication - allow both family members to view MCP status
    const session = await auth();
    const allowedEmails = ['sheridan.gray@gmail.com', 'joyce.yan.zhang@gmail.com'];
    
    if (!session?.user?.email || !allowedEmails.includes(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Forward request to backend
    const response = await fetch(`${BACKEND_API_URL}/api/admin/mcp-status`, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

  } catch (error) {
    console.error('MCP status API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}