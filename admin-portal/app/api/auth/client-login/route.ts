import { NextRequest, NextResponse } from 'next/server';
import { setAuthToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Use unified auth endpoint
    const response = await fetch(`${API_BASE_URL}/api/v2/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Login failed' },
        { status: response.status }
      );
    }

    // Check if user is a client
    if (data.user?.role !== 'client') {
      return NextResponse.json(
        { message: 'Access denied. This portal is for clients only.' },
        { status: 403 }
      );
    }

    // Set the token in HttpOnly cookie
    await setAuthToken(data.token);

    return NextResponse.json({
      message: 'Login successful',
      user: data.user,
    });
  } catch (error: any) {
    console.error('Client login error:', error);
    return NextResponse.json(
      { message: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}

