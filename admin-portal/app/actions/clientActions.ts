'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

// Create Supabase client (server-side)
// For admin operations, use SERVICE_ROLE_KEY to bypass RLS
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // Try to use service role key first (for admin operations), fallback to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials in .env.local');
  }
  
  console.log('🔑 Using Supabase with URL:', supabaseUrl);
  console.log('🔑 Key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE (bypasses RLS)' : 'ANON (subject to RLS)');
  
  return createSupabaseClient(supabaseUrl, supabaseKey);
}

// Hash password using bcrypt (industry standard)
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12; // Higher = more secure but slower (10-12 recommended)
  return await bcrypt.hash(password, saltRounds);
}

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

    // Fetch associated projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, location, start_date, end_date, status, budget, created_at')
      .eq('client_user_id', id)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
    } else {
      console.log(`✅ Found ${projects?.length || 0} projects for client ${id}`);
    }

    // Fetch associated supervisors
    const { data: supervisors, error: supervisorsError } = await supabase
      .from('supervisors')
      .select('id, name, email, phone, created_at')
      .eq('client_user_id', id)
      .order('name');

    if (supervisorsError) {
      console.error('Error fetching supervisors:', supervisorsError);
    } else {
      console.log(`✅ Found ${supervisors?.length || 0} supervisors for client ${id}`);
    }

    // Fetch associated staff/employees
    const { data: staff, error: staffError } = await supabase
      .from('employees')
      .select('id, name, email, phone, role, project_id')
      .eq('client_user_id', id)
      .order('name');

    if (staffError) {
      console.error('Error fetching staff:', staffError);
    } else {
      console.log(`✅ Found ${staff?.length || 0} staff for client ${id}`);
    }

    return {
      success: true,
<<<<<<< HEAD
      data: result.data,
=======
      data: {
        ...data,
        projects: projects || [],
        supervisors: supervisors || [],
        staff: staff || [],
      },
>>>>>>> a4f152ed4e64e77634119230cc2b7debffcfc50e
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
    const supabase = getSupabase();
    
    const { name, email, phone, password, is_active = true } = formData;
    
    console.log('🔵 Creating client with data:', { name, email, phone, is_active });
    
    // Validate name
    if (!name || !name.trim()) {
      console.error('❌ Validation failed: Name is required');
      return {
        success: false,
        error: 'Name is required',
      };
    }
    
    if (name.trim().length < 2) {
      return {
        success: false,
        error: 'Name must be at least 2 characters',
      };
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      console.error('❌ Email validation failed:', emailValidation.error);
      return {
        success: false,
        error: emailValidation.error,
      };
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      console.error('❌ Password validation failed:', passwordValidation.error);
      return {
        success: false,
        error: passwordValidation.error,
      };
    }
    
    // Validate phone (optional)
    // Singapore: 8 digits, International: 8-13 digits
    if (phone && phone.trim()) {
      const cleanPhone = phone.replace(/[\s+\-()]/g, '');
      if (!/^\d+$/.test(cleanPhone)) {
        return {
          success: false,
          error: 'Phone number must contain only digits',
        };
      }
      if (cleanPhone.length < 8 || cleanPhone.length > 13) {
        return {
          success: false,
          error: 'Phone number must be 8-13 digits (Singapore: 8 digits)',
        };
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email exists
    console.log('🔍 Checking if email exists:', normalizedEmail);
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking email:', checkError);
      return {
        success: false,
        error: `Database error: ${checkError.message}`,
      };
    }

    if (existing) {
      console.error('❌ Email already exists:', normalizedEmail);
      return {
        success: false,
        error: 'Email already exists',
      };
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    console.log('✅ Password hashed');

    // Insert user
    console.log('💾 Inserting user into database...');
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'client',
        name,
        phone: phone || null,
        is_active,
      })
      .select('id, name, email, phone, role, is_active, created_at')
      .single();

    if (error) {
      console.error('❌ Insert error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ Client created successfully:', data);

    // Revalidate the clients page
    revalidatePath('/clients');

    return {
      success: true,
      message: 'Client created successfully',
      data,
    };
  } catch (error: any) {
    console.error('❌ Error creating client:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to create client',
      details: error,
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
    const supabase = getSupabase();
    
    const { name, email, phone, password, is_active } = formData;

    // Check if client exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .eq('role', 'client')
      .single();

    if (!existing) {
      return {
        success: false,
        error: 'Client not found',
      };
    }

    // Build update object
    const updates: any = {};
    
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone || null;
    if (is_active !== undefined) updates.is_active = is_active;
    
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email exists for another user
      const { data: emailCheck } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .neq('id', id)
        .single();

      if (emailCheck) {
        return {
          success: false,
          error: 'Email already exists',
        };
      }
      
      updates.email = normalizedEmail;
    }

    if (password && password.trim()) {
      updates.password_hash = await hashPassword(password);
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: 'No fields to update',
      };
    }

    // Update user
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .eq('role', 'client')
      .select('id, name, email, phone, role, is_active, created_at')
      .single();

    if (error) throw error;

    // Revalidate pages
    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);

    return {
      success: true,
      message: 'Client updated successfully',
      data,
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
    const supabase = getSupabase();
    
    // Check if client exists
    const { data: existing } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', id)
      .eq('role', 'client')
      .single();

    if (!existing) {
      return {
        success: false,
        error: 'Client not found',
      };
    }

    // Delete user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Revalidate the clients page
    revalidatePath('/clients');

    return {
      success: true,
      message: 'Client deleted successfully',
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

<<<<<<< HEAD
    return {
      success: true,
      data: result.data,
=======
    // Get actual project counts
    const { count: totalProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_user_id', id);

    const { count: activeProjects } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_user_id', id)
      .or('end_date.is.null,end_date.gt.' + new Date().toISOString());

    // Get supervisor count
    const { count: supervisorCount } = await supabase
      .from('supervisors')
      .select('*', { count: 'exact', head: true })
      .eq('client_user_id', id);

    // Get staff/employee counts
    const { count: totalStaff } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('client_user_id', id);

    const { count: assignedStaff } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('client_user_id', id)
      .not('project_id', 'is', null);

    return {
      success: true,
      data: {
        projects: {
          total: totalProjects || 0,
          active: activeProjects || 0,
        },
        supervisors: supervisorCount || 0,
        staff: {
          total: totalStaff || 0,
          assigned: assignedStaff || 0,
          unassigned: (totalStaff || 0) - (assignedStaff || 0),
        },
      },
>>>>>>> a4f152ed4e64e77634119230cc2b7debffcfc50e
    };
  } catch (error: any) {
    console.error('Error fetching client stats:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch client stats',
    };
  }
}

