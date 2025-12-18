import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const url = `${API_BASE_URL}/api/client/supervisors`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to fetch supervisors',
        error: 'Backend request failed'
      }));
      console.error('Backend error response:', errorData);
      return NextResponse.json(
        { 
          success: false,
          error: errorData.error || errorData.message || 'Failed to fetch supervisors',
          message: errorData.message || 'Failed to fetch supervisors'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Proxy error (GET /client/supervisors):', error);
    
    if (error.message?.includes('fetch') || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Backend server is not available. Please ensure the server is running.',
          message: 'Connection failed'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch supervisors', 
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

