'use server';

import { revalidatePath } from 'next/cache';

export interface ClientData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  project_count?: number;
  supervisor_count?: number;
  staff_count?: number;
}

/**
 * Get all clients with pagination, search, and sorting
 */
export async function getAllClients(options?: {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  statusFilter?: 'all' | 'active' | 'inactive';
}) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
        data: [],
        pagination: {
          page: 1,
          limit: 9,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    const page = options?.page || 1;
    const limit = options?.limit || 9;
    const search = options?.search?.trim() || '';
    const sortBy = options?.sortBy || 'created_at';
    const sortOrder = options?.sortOrder || 'DESC';
    const statusFilter = options?.statusFilter || 'all';

    console.log('🔍 Fetching clients with:', { page, limit, search, sortBy, sortOrder, statusFilter });

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    
    // Build query params
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active' ? 'true' : 'false');
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);
    
    const url = `${API_BASE_URL}/api/admin/clients?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch clients' }));
      throw new Error(errorData.message || errorData.error || 'Failed to fetch clients');
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch clients',
        data: [],
        pagination: {
          page: 1,
          limit: 9,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
    }

    // Apply client-side pagination since backend doesn't support it yet
    const allClients = result.data || [];
    const totalClients = allClients.length;
    const offset = (page - 1) * limit;
    const paginatedClients = allClients.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalClients / limit);

    return {
      success: true,
      data: paginatedClients,
      pagination: {
        page,
        limit,
        total: totalClients,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch clients',
      data: [],
      pagination: {
        page: 1,
        limit: 9,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
}

/**
 * Get client by ID
 */
export async function getClientById(id: string) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${API_BASE_URL}/api/admin/clients/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch client' }));
      return {
        success: false,
        error: errorData.message || errorData.error || 'Failed to fetch client',
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch client',
      };
    }

    // The backend already returns projects, supervisors, and staff in the response
    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    console.error('Error fetching client:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch client',
    };
  }
}

/**
 * Validate email format (server-side)
 */
function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.trim();
  
  if (!trimmedEmail) {
    return { valid: false, error: 'Email is required' };
  }
  
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (trimmedEmail.length > 254) {
    return { valid: false, error: 'Email is too long (max 254 characters)' };
  }
  
  if (!trimmedEmail.includes('.')) {
    return { valid: false, error: 'Email must contain a domain' };
  }
  
  return { valid: true };
}

/**
 * Validate password strength (server-side)
 */
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' };
  }
  
  const errors = [];
  
  if (password.length < 8) {
    errors.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('one special character');
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long (max 128 characters)' };
  }
  
  if (errors.length > 0) {
    return { valid: false, error: `Password must contain ${errors.join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * Create new client
 */
export async function createClient(formData: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  is_active?: boolean;
}) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    
    // Build request payload
    const payload: any = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
    };
    
    if (formData.phone !== undefined) {
      payload.phone = formData.phone || null;
    }
    
    if (formData.is_active !== undefined) {
      payload.is_active = formData.is_active;
    }

    const response = await fetch(`${API_BASE_URL}/api/admin/clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to create client' }));
      return {
        success: false,
        error: errorData.error || errorData.message || 'Failed to create client',
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create client',
      };
    }

    // Revalidate pages
    revalidatePath('/clients');

    return {
      success: true,
      message: result.message || 'Client created successfully',
      data: result.data,
    };
  } catch (error: any) {
    console.error('Error creating client:', error);
    return {
      success: false,
      error: error.message || 'Failed to create client',
    };
  }
}

/**
 * Update client
 */
export async function updateClient(
  id: string,
  formData: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    is_active?: boolean;
  }
) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    
    // Build update payload
    const updates: any = {};
    if (formData.name !== undefined) updates.name = formData.name;
    if (formData.email !== undefined) updates.email = formData.email;
    if (formData.phone !== undefined) updates.phone = formData.phone || null;
    if (formData.password !== undefined && formData.password.trim()) {
      updates.password = formData.password;
    }
    if (formData.is_active !== undefined) updates.is_active = formData.is_active;

    const response = await fetch(`${API_BASE_URL}/api/admin/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to update client' }));
      return {
        success: false,
        error: errorData.error || errorData.message || 'Failed to update client',
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update client',
      };
    }

    // Revalidate pages
    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);

    return {
      success: true,
      message: result.message || 'Client updated successfully',
      data: result.data,
    };
  } catch (error: any) {
    console.error('Error updating client:', error);
    return {
      success: false,
      error: error.message || 'Failed to update client',
    };
  }
}

/**
 * Delete client
 */
export async function deleteClient(id: string) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${API_BASE_URL}/api/admin/clients/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to delete client' }));
      return {
        success: false,
        error: errorData.error || errorData.message || 'Failed to delete client',
      };
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete client',
      };
    }

    // Revalidate the clients page
    revalidatePath('/clients');

    return {
      success: true,
      message: result.message || 'Client deleted successfully',
    };
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete client',
    };
  }
}

/**
 * Get client statistics
 */
export async function getClientStats(id: string) {
  try {
    // Get auth token from cookies
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    
    if (!token) {
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${API_BASE_URL}/api/admin/clients/${id}/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to fetch client stats' }));
      return {
        success: false,
        error: errorData.message || errorData.error || 'Failed to fetch client stats',
      };
    }

    const result = await response.json();
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch client stats',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error: any) {
    console.error('Error fetching client stats:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch client stats',
    };
  }
}

