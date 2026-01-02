/**
 * Validation Utility Tests
 * 
 * Tests for form validation functions including:
 * - Email validation
 * - Phone validation
 * - Password validation
 * - Date validation
 * - Required field validation
 */

describe('Validation Utilities', () => {
  // Email Validation
  describe('validateEmail', () => {
    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    it('should return true for valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@domain.org')).toBe(true);
      expect(validateEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  // Phone Validation
  describe('validatePhone', () => {
    const validatePhone = (phone: string): boolean => {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    };

    it('should return true for valid phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('123-456-7890')).toBe(true);
      expect(validatePhone('+1 (234) 567-8900')).toBe(true);
      expect(validatePhone('12345678901234')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('12345')).toBe(false);
      expect(validatePhone('')).toBe(false);
      expect(validatePhone('1234567890123456')).toBe(false); // Too long
    });
  });

  // Password Validation
  describe('validatePassword', () => {
    const validatePassword = (password: string, minLength = 8): {
      isValid: boolean;
      errors: string[];
    } => {
      const errors: string[] = [];
      
      if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters`);
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      
      return { isValid: errors.length === 0, errors };
    };

    it('should return valid for strong password', () => {
      const result = validatePassword('Password123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for weak password', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require minimum length', () => {
      const result = validatePassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should require uppercase letter', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letter', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require number', () => {
      const result = validatePassword('PasswordABC');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  // Date Validation
  describe('validateDate', () => {
    const validateDate = (dateString: string): boolean => {
      const date = new Date(dateString);
      return !isNaN(date.getTime());
    };

    it('should return true for valid dates', () => {
      expect(validateDate('2024-01-15')).toBe(true);
      expect(validateDate('2024-12-31')).toBe(true);
      expect(validateDate('2024-01-15T09:00:00Z')).toBe(true);
    });

    it('should return false for invalid dates', () => {
      expect(validateDate('invalid')).toBe(false);
      expect(validateDate('')).toBe(false);
      expect(validateDate('not-a-date')).toBe(false);
    });
  });

  // Date Range Validation
  describe('validateDateRange', () => {
    const validateDateRange = (startDate: string, endDate: string): {
      isValid: boolean;
      error: string | null;
    } => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime())) {
        return { isValid: false, error: 'Invalid start date' };
      }
      if (isNaN(end.getTime())) {
        return { isValid: false, error: 'Invalid end date' };
      }
      if (end < start) {
        return { isValid: false, error: 'End date must be after start date' };
      }
      
      return { isValid: true, error: null };
    };

    it('should return valid for correct date range', () => {
      const result = validateDateRange('2024-01-01', '2024-01-15');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should return valid for same start and end date', () => {
      const result = validateDateRange('2024-01-15', '2024-01-15');
      expect(result.isValid).toBe(true);
    });

    it('should return error when end date is before start date', () => {
      const result = validateDateRange('2024-01-15', '2024-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('End date must be after start date');
    });

    it('should return error for invalid start date', () => {
      const result = validateDateRange('invalid', '2024-01-15');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid start date');
    });
  });

  // Required Field Validation
  describe('validateRequired', () => {
    const validateRequired = (value: any): boolean => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    };

    it('should return true for non-empty values', () => {
      expect(validateRequired('value')).toBe(true);
      expect(validateRequired(['item'])).toBe(true);
      expect(validateRequired(123)).toBe(true);
      expect(validateRequired(true)).toBe(true);
      expect(validateRequired({ key: 'value' })).toBe(true);
    });

    it('should return false for empty or missing values', () => {
      expect(validateRequired('')).toBe(false);
      expect(validateRequired('   ')).toBe(false);
      expect(validateRequired([])).toBe(false);
      expect(validateRequired(null)).toBe(false);
      expect(validateRequired(undefined)).toBe(false);
    });
  });

  // Employee Form Validation
  describe('validateEmployeeForm', () => {
    const validateEmployeeForm = (data: {
      name?: string;
      email?: string;
      phone?: string;
    }): { isValid: boolean; errors: Record<string, string> } => {
      const errors: Record<string, string> = {};
      
      if (!data.name || data.name.trim() === '') {
        errors.name = 'Name is required';
      }
      
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.email = 'Invalid email format';
      }
      
      if (data.phone) {
        const cleanPhone = data.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length < 10) {
          errors.phone = 'Phone number must be at least 10 digits';
        }
      }
      
      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    };

    it('should return valid for correct employee data', () => {
      const result = validateEmployeeForm({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890',
      });
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should require name', () => {
      const result = validateEmployeeForm({
        email: 'john@example.com',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('Name is required');
    });

    it('should validate email format when provided', () => {
      const result = validateEmployeeForm({
        name: 'John Doe',
        email: 'invalid-email',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe('Invalid email format');
    });

    it('should validate phone format when provided', () => {
      const result = validateEmployeeForm({
        name: 'John Doe',
        phone: '123',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.phone).toBe('Phone number must be at least 10 digits');
    });

    it('should allow missing optional fields', () => {
      const result = validateEmployeeForm({
        name: 'John Doe',
      });
      expect(result.isValid).toBe(true);
    });
  });

  // Leave Request Validation
  describe('validateLeaveRequest', () => {
    const validateLeaveRequest = (data: {
      employeeId?: string;
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    }): { isValid: boolean; errors: Record<string, string> } => {
      const errors: Record<string, string> = {};
      
      if (!data.employeeId) {
        errors.employeeId = 'Employee is required';
      }
      
      if (!data.leaveTypeId) {
        errors.leaveTypeId = 'Leave type is required';
      }
      
      if (!data.startDate) {
        errors.startDate = 'Start date is required';
      }
      
      if (!data.endDate) {
        errors.endDate = 'End date is required';
      }
      
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        if (end < start) {
          errors.dateRange = 'End date must be after start date';
        }
      }
      
      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    };

    it('should return valid for correct leave request', () => {
      const result = validateLeaveRequest({
        employeeId: 'emp1',
        leaveTypeId: 'type1',
        startDate: '2024-01-15',
        endDate: '2024-01-16',
        reason: 'Personal leave',
      });
      expect(result.isValid).toBe(true);
    });

    it('should require all mandatory fields', () => {
      const result = validateLeaveRequest({});
      expect(result.isValid).toBe(false);
      expect(result.errors.employeeId).toBeDefined();
      expect(result.errors.leaveTypeId).toBeDefined();
      expect(result.errors.startDate).toBeDefined();
      expect(result.errors.endDate).toBeDefined();
    });

    it('should validate date range', () => {
      const result = validateLeaveRequest({
        employeeId: 'emp1',
        leaveTypeId: 'type1',
        startDate: '2024-01-16',
        endDate: '2024-01-15',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.dateRange).toBe('End date must be after start date');
    });
  });
});

