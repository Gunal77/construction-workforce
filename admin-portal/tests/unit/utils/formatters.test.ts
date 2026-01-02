/**
 * Formatter Utility Tests
 * 
 * Tests for data formatting functions including:
 * - Date formatting
 * - Time formatting
 * - Number formatting
 * - Currency formatting
 * - String formatting
 */

describe('Formatter Utilities', () => {
  // Date Formatting
  describe('formatDate', () => {
    const formatDate = (dateString: string, locale = 'en-GB'): string => {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString(locale);
    };

    it('should format date correctly', () => {
      const result = formatDate('2024-01-15');
      expect(result).toMatch(/15\/01\/2024|1\/15\/2024/); // GB or US format
    });

    it('should handle ISO date strings', () => {
      const result = formatDate('2024-01-15T09:30:00Z');
      expect(result).toBeDefined();
      expect(result).not.toBe('Invalid Date');
    });

    it('should return Invalid Date for invalid input', () => {
      expect(formatDate('invalid')).toBe('Invalid Date');
      expect(formatDate('')).toBe('Invalid Date');
    });
  });

  // Time Formatting
  describe('formatTime', () => {
    const formatTime = (dateString: string): string => {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Time';
      
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    };

    it('should format morning time correctly', () => {
      const result = formatTime('2024-01-15T09:30:00');
      expect(result).toBe('9:30 AM');
    });

    it('should format afternoon time correctly', () => {
      const result = formatTime('2024-01-15T14:30:00');
      expect(result).toBe('2:30 PM');
    });

    it('should format midnight correctly', () => {
      const result = formatTime('2024-01-15T00:00:00');
      expect(result).toBe('12:00 AM');
    });

    it('should format noon correctly', () => {
      const result = formatTime('2024-01-15T12:00:00');
      expect(result).toBe('12:00 PM');
    });

    it('should handle invalid input', () => {
      expect(formatTime('invalid')).toBe('Invalid Time');
    });
  });

  // Duration Formatting
  describe('formatDuration', () => {
    const formatDuration = (startTime: string, endTime: string | null): string => {
      if (!endTime) return '-';
      
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const diffMs = end - start;
      
      if (diffMs < 0) return 'Invalid Duration';
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return `${hours}h ${minutes}m`;
    };

    it('should format duration correctly', () => {
      const result = formatDuration(
        '2024-01-15T09:00:00',
        '2024-01-15T17:30:00'
      );
      expect(result).toBe('8h 30m');
    });

    it('should return dash for missing end time', () => {
      expect(formatDuration('2024-01-15T09:00:00', null)).toBe('-');
    });

    it('should handle same start and end time', () => {
      const result = formatDuration(
        '2024-01-15T09:00:00',
        '2024-01-15T09:00:00'
      );
      expect(result).toBe('0h 0m');
    });

    it('should handle invalid duration', () => {
      const result = formatDuration(
        '2024-01-15T17:00:00',
        '2024-01-15T09:00:00'
      );
      expect(result).toBe('Invalid Duration');
    });
  });

  // Number Formatting
  describe('formatNumber', () => {
    const formatNumber = (value: number, locale = 'en-US'): string => {
      return value.toLocaleString(locale);
    };

    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle decimal numbers', () => {
      const result = formatNumber(1234.56);
      expect(result).toMatch(/1,234\.56|1,234.56/);
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1000);
      expect(result).toMatch(/-1,000|-1,000/);
    });
  });

  // Currency Formatting
  describe('formatCurrency', () => {
    const formatCurrency = (
      value: number,
      currency = 'USD',
      locale = 'en-US'
    ): string => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      }).format(value);
    };

    it('should format USD currency', () => {
      const result = formatCurrency(1234.56);
      expect(result).toMatch(/\$1,234\.56/);
    });

    it('should format different currencies', () => {
      const sgdResult = formatCurrency(1234.56, 'SGD');
      expect(sgdResult).toContain('1,234.56');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/\$0\.00/);
    });

    it('should handle negative values', () => {
      const result = formatCurrency(-100);
      expect(result).toMatch(/-\$100\.00|\(\$100\.00\)/);
    });
  });

  // Phone Number Formatting
  describe('formatPhoneNumber', () => {
    const formatPhoneNumber = (phone: string): string => {
      const cleaned = phone.replace(/\D/g, '');
      
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      
      return phone; // Return as-is if not 10 digits
    };

    it('should format 10-digit phone numbers', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
    });

    it('should handle already formatted numbers', () => {
      expect(formatPhoneNumber('123-456-7890')).toBe('(123) 456-7890');
    });

    it('should return original for non-standard lengths', () => {
      expect(formatPhoneNumber('12345')).toBe('12345');
      expect(formatPhoneNumber('+1234567890123')).toBe('+1234567890123');
    });
  });

  // Status Badge Formatting
  describe('formatStatus', () => {
    const formatStatus = (status: string): {
      label: string;
      className: string;
    } => {
      const statusMap: Record<string, { label: string; className: string }> = {
        active: { label: 'Active', className: 'bg-green-100 text-green-800' },
        inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-800' },
        pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
        approved: { label: 'Approved', className: 'bg-green-100 text-green-800' },
        rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
        'checked-in': { label: 'Checked In', className: 'bg-blue-100 text-blue-800' },
        'checked-out': { label: 'Checked Out', className: 'bg-green-100 text-green-800' },
      };
      
      return statusMap[status.toLowerCase()] || {
        label: status,
        className: 'bg-gray-100 text-gray-800',
      };
    };

    it('should return correct styling for active status', () => {
      const result = formatStatus('active');
      expect(result.label).toBe('Active');
      expect(result.className).toContain('green');
    });

    it('should return correct styling for pending status', () => {
      const result = formatStatus('pending');
      expect(result.label).toBe('Pending');
      expect(result.className).toContain('yellow');
    });

    it('should return correct styling for rejected status', () => {
      const result = formatStatus('rejected');
      expect(result.label).toBe('Rejected');
      expect(result.className).toContain('red');
    });

    it('should handle unknown status', () => {
      const result = formatStatus('unknown');
      expect(result.label).toBe('unknown');
      expect(result.className).toContain('gray');
    });

    it('should be case insensitive', () => {
      expect(formatStatus('ACTIVE').label).toBe('Active');
      expect(formatStatus('Pending').label).toBe('Pending');
    });
  });

  // Truncate Text
  describe('truncateText', () => {
    const truncateText = (text: string, maxLength: number): string => {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength - 3) + '...';
    };

    it('should truncate long text', () => {
      const result = truncateText('This is a very long text', 15);
      expect(result).toBe('This is a ve...');
      expect(result.length).toBe(15);
    });

    it('should not truncate short text', () => {
      const result = truncateText('Short', 10);
      expect(result).toBe('Short');
    });

    it('should handle exact length', () => {
      const result = truncateText('Exact', 5);
      expect(result).toBe('Exact');
    });
  });

  // Name Formatting
  describe('formatName', () => {
    const formatName = (firstName: string, lastName?: string): string => {
      if (lastName) {
        return `${firstName} ${lastName}`;
      }
      return firstName;
    };

    const getInitials = (name: string): string => {
      const parts = name.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0]?.[0]?.toUpperCase() || '';
    };

    it('should format full name', () => {
      expect(formatName('John', 'Doe')).toBe('John Doe');
    });

    it('should handle single name', () => {
      expect(formatName('John')).toBe('John');
    });

    it('should get initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
      expect(getInitials('Jane Mary Smith')).toBe('JS');
    });

    it('should get initial from single name', () => {
      expect(getInitials('John')).toBe('J');
    });
  });
});

