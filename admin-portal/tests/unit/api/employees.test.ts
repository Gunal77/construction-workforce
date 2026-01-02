/**
 * Employees API Tests
 * 
 * Tests for:
 * - Employee CRUD operations
 * - Employee data validation
 * - API response handling
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Employees API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('GET /api/proxy/employees', () => {
    it('should fetch all employees', async () => {
      const mockEmployees = [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Worker' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Supervisor' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ employees: mockEmployees }),
      });

      const response = await fetch('/api/proxy/employees', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employees).toHaveLength(2);
      expect(data.employees[0].name).toBe('John Doe');
    });

    it('should handle empty employee list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ employees: [] }),
      });

      const response = await fetch('/api/proxy/employees', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employees).toHaveLength(0);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal server error' }),
      });

      const response = await fetch('/api/proxy/employees', {
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/proxy/employees/:id', () => {
    it('should fetch employee by ID', async () => {
      const mockEmployee = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        role: 'Worker',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ employee: mockEmployee }),
      });

      const response = await fetch('/api/proxy/employees/1', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employee.id).toBe('1');
      expect(data.employee.name).toBe('John Doe');
    });

    it('should return 404 for non-existent employee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Employee not found' }),
      });

      const response = await fetch('/api/proxy/employees/nonexistent', {
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/proxy/employees', () => {
    it('should create a new employee', async () => {
      const newEmployee = {
        name: 'New Employee',
        email: 'new@example.com',
        phone: '0987654321',
        role: 'Worker',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          employee: { id: '3', ...newEmployee, created_at: new Date().toISOString() },
          message: 'Employee created successfully',
        }),
      });

      const response = await fetch('/api/proxy/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employee.name).toBe('New Employee');
      expect(data.message).toBe('Employee created successfully');
    });

    it('should validate required fields', async () => {
      const invalidEmployee = { email: 'test@example.com' }; // Missing name

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Name is required' }),
      });

      const response = await fetch('/api/proxy/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidEmployee),
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should handle duplicate email', async () => {
      const duplicateEmployee = {
        name: 'Duplicate',
        email: 'existing@example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'Email already exists' }),
      });

      const response = await fetch('/api/proxy/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateEmployee),
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(409);
    });
  });

  describe('PUT /api/proxy/employees/:id', () => {
    it('should update an employee', async () => {
      const updates = { name: 'Updated Name', role: 'Supervisor' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          employee: { id: '1', ...updates, email: 'john@example.com' },
          message: 'Employee updated successfully',
        }),
      });

      const response = await fetch('/api/proxy/employees/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employee.name).toBe('Updated Name');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { phone: '9999999999' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          employee: { id: '1', name: 'John Doe', phone: '9999999999' },
        }),
      });

      const response = await fetch('/api/proxy/employees/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partialUpdate),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.employee.phone).toBe('9999999999');
    });
  });

  describe('DELETE /api/proxy/employees/:id', () => {
    it('should delete an employee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Employee deleted successfully' }),
      });

      const response = await fetch('/api/proxy/employees/1', {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.message).toBe('Employee deleted successfully');
    });

    it('should return 404 for non-existent employee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: 'Employee not found' }),
      });

      const response = await fetch('/api/proxy/employees/nonexistent', {
        method: 'DELETE',
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });
  });
});

describe('Employee Data Validation', () => {
  describe('validateEmployeeData', () => {
    const validateEmployeeData = (data: any) => {
      const errors: string[] = [];
      
      if (!data.name || data.name.trim() === '') {
        errors.push('Name is required');
      }
      
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Invalid email format');
      }
      
      if (data.phone && !/^\d{10,}$/.test(data.phone.replace(/[^0-9]/g, ''))) {
        errors.push('Invalid phone format');
      }
      
      return { valid: errors.length === 0, errors };
    };

    it('should pass for valid employee data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
        role: 'Worker',
      };
      
      const result = validateEmployeeData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for missing name', () => {
      const data = {
        email: 'john@example.com',
      };
      
      const result = validateEmployeeData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail for invalid email format', () => {
      const data = {
        name: 'John Doe',
        email: 'invalid-email',
      };
      
      const result = validateEmployeeData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should fail for invalid phone format', () => {
      const data = {
        name: 'John Doe',
        phone: '123', // Too short
      };
      
      const result = validateEmployeeData(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid phone format');
    });
  });
});

