import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_URL = process.env.BACKEND_API_URL || "https://family-event-planner-backend.onrender.com";
const API_KEY = process.env.BACKEND_API_KEY || "fep_secure_api_key_2024_$7mK9pL2nQ8xV3wR6zA";

export async function GET(request: NextRequest) {
  try {
    console.log('Frontend API: Using BACKEND_API_URL:', BACKEND_API_URL);
    console.log('Frontend API: Using API_KEY:', API_KEY);
    const response = await fetch(`${BACKEND_API_URL}/api/family/settings`, {
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Family settings API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch family settings'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_API_URL}/api/family/settings`, {
      method: 'PUT',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Family settings update API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update family settings'
    }, { status: 500 });
  }
}