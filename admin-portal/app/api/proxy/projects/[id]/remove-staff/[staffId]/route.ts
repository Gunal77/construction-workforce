import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; staffId: string } }
) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id, staffId } = params;

    const response = await fetch(`${API_BASE_URL}/api/admin/projects/${id}/remove-staff/${staffId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'Failed to remove staff' },
      { status: 500 }
    );
  }
}

