import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch current user info from unified auth
    const response = await fetch(`${API_BASE_URL}/api/v2/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Backend /api/v2/auth/me error:', errorData);
      return NextResponse.json(
        { message: errorData.message || 'Failed to fetch user info' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Ensure the response has the correct structure
    if (data.success && data.data) {
      return NextResponse.json(data);
    } else if (data.data) {
      return NextResponse.json({ success: true, data: data.data });
    } else {
      return NextResponse.json({ success: true, data: data });
    }
  } catch (error: any) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch user info' },
      { status: 500 }
    );
  }
}

