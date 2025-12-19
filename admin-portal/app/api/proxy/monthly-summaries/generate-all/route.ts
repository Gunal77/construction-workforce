import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const url = `${API_BASE_URL}/api/monthly-summaries/generate-all`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to generate monthly summaries',
        error: 'Backend request failed'
      }));
      return NextResponse.json(
        { 
          success: false,
          error: errorData.error || errorData.message || 'Failed to generate monthly summaries',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Proxy error (POST /monthly-summaries/generate-all):', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate monthly summaries',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

