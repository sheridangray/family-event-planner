import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Call the backend API with the API key
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured'
      }, { status: 500 });
    }

    const response = await fetch(`${backendUrl}/api/admin/user-auth-status`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-user-email': session.user.email // Pass user email as header
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `Backend error: ${response.statusText}`
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('User auth status error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}