import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch project stats for the authenticated client (already filtered by backend)
    const response = await fetch(`${API_BASE_URL}/api/client/projects/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { message: errorData.message || 'Failed to fetch project stats' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy GET /api/proxy/client/projects/stats error:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

