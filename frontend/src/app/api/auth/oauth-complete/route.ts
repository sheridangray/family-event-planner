import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    const { authCode } = await request.json();
    
    if (!authCode) {
      return NextResponse.json({
        success: false,
        error: 'Authorization code is required'
      }, { status: 400 });
    }

    // Call the backend API with the API key
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiKey = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

    const response = await fetch(`${backendUrl}/api/admin/mcp-auth-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        email: session.user.email,
        authCode: authCode.trim()
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({
        success: false,
        error: errorData
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('OAuth complete error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}