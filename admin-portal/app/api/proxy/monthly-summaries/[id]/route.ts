import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const url = `${API_BASE_URL}/api/monthly-summaries/${params.id}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to fetch monthly summary',
        error: 'Backend request failed'
      }));
      return NextResponse.json(
        { 
          success: false,
          error: errorData.error || errorData.message || 'Failed to fetch monthly summary',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy error (GET /monthly-summaries/[id]):', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch monthly summary',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

