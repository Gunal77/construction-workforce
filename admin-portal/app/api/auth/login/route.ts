import { NextRequest, NextResponse } from 'next/server';
import { setAuthToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Call backend directly with timeout for faster response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for faster feedback

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, source: 'admin-portal' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { message: data.message || 'Login failed' },
          { status: response.status }
        );
      }

      // Set the token in HttpOnly cookie
      await setAuthToken(data.token);

      return NextResponse.json({
        message: 'Login successful',
        user: data.user,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { message: 'Request timed out. Please check your connection and try again.' },
          { status: 408 }
        );
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: error.message || 'Login failed. Please try again.' },
      { status: error.status || 500 }
    );
  }
}

