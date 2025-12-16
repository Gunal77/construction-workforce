import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.my-backend.com/v1';

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for HttpOnly cookies
});

// Request interceptor to add auth token if available
api.interceptors.request.use(
  async (config) => {
    // For client-side requests, we'll use Next.js API routes that handle cookies
    // The token is stored in HttpOnly cookie, so we can't access it from client
    // All client-side API calls should go through /api/proxy routes
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    // Backend supports both /api/admin/auth and /admin/auth
    const response = await api.post('/api/admin/auth/login', { email, password });
    return response.data;
  },
};

// Employees API - using Next.js API routes as proxy to handle HttpOnly cookies
export const employeesAPI = {
  getAll: async () => {
    const response = await fetch('/api/proxy/employees', {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getById: async (id: string) => {
    const response = await fetch(`/api/proxy/employees/${id}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  create: async (data: {
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    project_id?: string;
  }) => {
    const response = await fetch('/api/proxy/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  update: async (id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    project_id?: string;
  }) => {
    const response = await fetch(`/api/proxy/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  delete: async (id: string) => {
    const response = await fetch(`/api/proxy/employees/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

// Attendance API - using Next.js API routes as proxy to handle HttpOnly cookies
export const attendanceAPI = {
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
    const response = await fetch(`/api/proxy/attendance${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/api/attendance/${id}`);
    return response.data;
  },
  create: async (data: {
    user_id: string;
    check_in_time?: string;
    check_out_time?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const response = await fetch('/api/proxy/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
};

// Projects API - using Next.js API routes as proxy to handle HttpOnly cookies
export const projectsAPI = {
  getAll: async () => {
    const response = await fetch('/api/proxy/projects', {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getById: async (id: string) => {
    const response = await fetch(`/api/proxy/projects/${id}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  create: async (data: {
    name: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    budget?: number;
    client_user_id: string; // Now required
  }) => {
    const response = await fetch('/api/proxy/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  update: async (id: string, data: {
    name?: string;
    location?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    budget?: number;
    client_user_id?: string;
    status?: string;
  }) => {
    const response = await fetch(`/api/proxy/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  delete: async (id: string) => {
    const response = await fetch(`/api/proxy/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  assignStaffs: async (projectId: string, staffIds: string[]) => {
    const response = await fetch(`/api/proxy/projects/${projectId}/assign-staffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff_ids: staffIds }),
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  removeStaff: async (projectId: string, staffId: string) => {
    const response = await fetch(`/api/proxy/projects/${projectId}/remove-staff/${staffId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getProjectStaffs: async (projectId: string) => {
    const response = await fetch(`/api/proxy/projects/${projectId}/staffs`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getSupervisors: async () => {
    const response = await fetch('/api/proxy/projects/supervisors/list', {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

// Types
export interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  project_id?: string;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    location?: string;
  };
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  user_email?: string;
  check_in_time: string;
  check_out_time?: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
}

export interface LoginResponse {
  token: string;
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface Project {
  id: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  client_user_id?: string;
  client_name?: string;
  description?: string;
  budget?: number;
  staff_count?: number;
  supervisor_name?: string;
  supervisor_id?: string;
  status?: string;
}

// Last End Date API
export const lastEndDateAPI = {
  getAll: async (params?: {
    employeeIds?: string[];
    inactiveDays?: number;
  }) => {
    const queryString = params
      ? '?' + new URLSearchParams(
          Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null) {
              if (Array.isArray(value)) {
                acc[key] = value.join(',');
              } else {
                acc[key] = String(value);
              }
            }
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : '';
    const response = await fetch(`/api/proxy/attendance/last-end-dates${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

// Leave Management Types
export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description?: string;
  requires_approval: boolean;
  max_days_per_year?: number;
  auto_reset_annually: boolean;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  leave_type_name: string;
  leave_type_code: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  number_of_days: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  employee_name: string;
  employee_email: string;
  leave_type_name: string;
  leave_type_code: string;
  approved_by_name?: string;
}

// Leave Management API
export const leaveAPI = {
  getTypes: async () => {
    const response = await fetch('/api/proxy/leave/types', {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getBalance: async (employeeId: string, year?: number) => {
    const queryString = year ? `?year=${year}` : '';
    const response = await fetch(`/api/proxy/leave/balance/${employeeId}${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getRequests: async (params?: {
    employeeId?: string;
    status?: string;
    year?: number;
    month?: number;
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
    const response = await fetch(`/api/proxy/leave/requests${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  createRequest: async (data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }) => {
    const response = await fetch('/api/proxy/leave/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: data.employeeId,
        leave_type_id: data.leaveTypeId,
        start_date: data.startDate,
        end_date: data.endDate,
        reason: data.reason,
      }),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  updateRequestStatus: async (requestId: string, status: string, rejectionReason?: string) => {
    const response = await fetch(`/api/proxy/leave/admin/requests/${requestId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  getStatistics: async (year?: number) => {
    const queryString = year ? `?year=${year}` : '';
    const response = await fetch(`/api/proxy/leave/admin/statistics${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

// Timesheet interfaces
export interface Timesheet {
  id: string;
  staff_id: string;
  staff_name: string;
  staff_email: string;
  staff_role?: string;
  work_date: string;
  check_in: string;
  check_out?: string;
  total_hours: number;
  overtime_hours: number;
  project_id?: string;
  project_name?: string;
  task_type?: string;
  status: 'Present' | 'Absent' | 'Half-Day';
  approval_status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  ot_approval_status?: 'Pending' | 'Approved' | 'Rejected';
  remarks?: string;
  ot_justification?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  ot_approved_by?: string;
  ot_approved_by_name?: string;
  ot_approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TimesheetStats {
  todayTotalOT: number;
  pendingTimesheetApprovals: number;
  pendingOTApprovals: number;
}

// Client interfaces
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_email?: string;
  updated_by_email?: string;
  project_count?: number;
  supervisor_count?: number;
  staff_count?: number;
  projects?: Project[];
  supervisors?: any[];
  staff?: Employee[];
}

export interface ClientStats {
  projects: {
    total: number;
    active: number;
  };
  supervisors: number;
  staff: {
    total: number;
    assigned: number;
    unassigned: number;
  };
}

// Client API
export const clientsAPI = {
  getAll: async (params?: {
    search?: string;
    isActive?: boolean;
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
    const response = await fetch(`/api/proxy/clients${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getById: async (id: string) => {
    const response = await fetch(`/api/proxy/clients/${id}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  create: async (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }) => {
    const response = await fetch('/api/proxy/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  update: async (id: string, data: {
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    is_active?: boolean;
  }) => {
    const response = await fetch(`/api/proxy/clients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  delete: async (id: string) => {
    const response = await fetch(`/api/proxy/clients/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getStats: async (id: string) => {
    const response = await fetch(`/api/proxy/clients/${id}/stats`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

// Timesheet API
export const timesheetAPI = {
  getTimesheets: async (params?: {
    staffId?: string;
    projectId?: string;
    status?: string;
    approvalStatus?: string;
    otApprovalStatus?: string;
    startDate?: string;
    endDate?: string;
    view?: string;
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
    const response = await fetch(`/api/proxy/timesheets${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getTimesheetById: async (id: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  createTimesheet: async (data: {
    staffId: string;
    workDate: string;
    checkIn: string;
    checkOut?: string;
    projectId?: string;
    taskType?: string;
    status?: string;
    remarks?: string;
  }) => {
    const response = await fetch('/api/proxy/timesheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        staffId: data.staffId,
        workDate: data.workDate,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        projectId: data.projectId,
        taskType: data.taskType,
        status: data.status,
        remarks: data.remarks,
      }),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  updateTimesheet: async (id: string, data: {
    workDate?: string;
    checkIn?: string;
    checkOut?: string;
    projectId?: string;
    taskType?: string;
    status?: string;
    remarks?: string;
  }) => {
    const response = await fetch(`/api/proxy/timesheets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  submitTimesheet: async (id: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}/submit`, {
      method: 'POST',
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  approveTimesheet: async (id: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}/approve`, {
      method: 'POST',
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  rejectTimesheet: async (id: string, reason?: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  approveOT: async (id: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}/ot/approve`, {
      method: 'POST',
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  rejectOT: async (id: string, reason?: string) => {
    const response = await fetch(`/api/proxy/timesheets/${id}/ot/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      credentials: 'include',
    });
    const responseData = await response.json();
    if (!response.ok) throw { response: { status: response.status, data: responseData } };
    return responseData;
  },
  getStats: async (date?: string) => {
    const queryString = date ? `?date=${date}` : '';
    const response = await fetch(`/api/proxy/timesheets/stats${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
  getReports: async (params: {
    type: 'individual' | 'monthly_ot' | 'project_ot_cost';
    staffId?: string;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    month?: number;
    year?: number;
  }) => {
    const queryString = '?' + new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString();
    const response = await fetch(`/api/proxy/timesheets/reports${queryString}`, {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return data;
  },
};

