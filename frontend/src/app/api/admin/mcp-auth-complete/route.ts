import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email || session.user.email !== "sheridan.gray@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { email, authCode } = body;

    if (!email || !authCode) {
      return NextResponse.json({ error: "Email and auth code are required" }, { status: 400 });
    }

    // Forward request to backend
    const response = await fetch(`${BACKEND_API_URL}/api/admin/mcp-auth-complete`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, authCode })
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

  } catch (error) {
    console.error('MCP auth complete API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}