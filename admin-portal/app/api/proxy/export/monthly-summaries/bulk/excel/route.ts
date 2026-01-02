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
    const { summaryIds } = body;

    if (!summaryIds || !Array.isArray(summaryIds) || summaryIds.length === 0) {
      return NextResponse.json(
        { error: 'summaryIds array is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/api/export/monthly-summaries/bulk/excel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summaryIds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        message: 'Failed to export Excel',
        error: 'Backend request failed'
      }));
      return NextResponse.json(
        { 
          success: false,
          error: errorData.error || errorData.message || 'Failed to export Excel',
        },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="monthly-summaries-bulk-${Date.now()}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Proxy error (POST /export/monthly-summaries/bulk/excel):', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to export Excel',
        message: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

