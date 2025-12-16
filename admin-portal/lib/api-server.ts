import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value || null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw { response: { status: response.status, data: error } };
  }

  return response.json();
}

// Server-side API functions
export const serverAPI = {
  employees: {
    getAll: async () => {
      return fetchWithAuth('/api/admin/employees');
    },
    getById: async (id: string) => {
      return fetchWithAuth(`/api/admin/employees/${id}`);
    },
  },
  attendance: {
    getAll: async (params?: {
      employeeId?: string;
      from?: string;
      to?: string;
      user?: string;
      date?: string;
      month?: number;
      year?: number;
      sortBy?: string;
      sortOrder?: string;
    }) => {
      const queryString = params
        ? '?' + new URLSearchParams(
            Object.entries(params).reduce((acc, [key, value]) => {
              if (value !== undefined && value !== null && value !== '') {
                acc[key] = String(value);
              }
              return acc;
            }, {} as Record<string, string>)
          ).toString()
        : '';
      return fetchWithAuth(`/api/attendance/admin/all${queryString}`);
    },
  },
  projects: {
    getAll: async () => {
      return fetchWithAuth('/api/admin/projects');
    },
    getById: async (id: string) => {
      return fetchWithAuth(`/api/admin/projects/${id}`);
    },
  },
};

