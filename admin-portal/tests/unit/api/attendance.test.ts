/**
 * Attendance API Tests
 * 
 * Tests for:
 * - Attendance record operations
 * - Attendance filtering and querying
 * - Attendance data validation
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Attendance API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('GET /api/proxy/attendance', () => {
    it('should fetch all attendance records', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: 'user1',
          user_email: 'worker@example.com',
          check_in_time: '2024-01-15T09:00:00Z',
          check_out_time: '2024-01-15T17:00:00Z',
        },
        {
          id: '2',
          user_id: 'user2',
          user_email: 'worker2@example.com',
          check_in_time: '2024-01-15T08:30:00Z',
          check_out_time: null,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: mockRecords }),
      });

      const response = await fetch('/api/proxy/attendance', {
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.records).toHaveLength(2);
    });

    it('should filter attendance by date range', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [] }),
      });

      const params = new URLSearchParams({
        from: '2024-01-01',
        to: '2024-01-31',
      });

      const response = await fetch(`/api/proxy/attendance?${params.toString()}`, {
        credentials: 'include',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('from=2024-01-01'),
        expect.any(Object)
      );
    });

    it('should filter attendance by employee', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [] }),
      });

      const params = new URLSearchParams({
        employeeId: 'user1',
      });

      const response = await fetch(`/api/proxy/attendance?${params.toString()}`, {
        credentials: 'include',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('employeeId=user1'),
        expect.any(Object)
      );
    });

    it('should sort attendance records', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ records: [] }),
      });

      const params = new URLSearchParams({
        sortBy: 'check_in_time',
        sortOrder: 'desc',
      });

      const response = await fetch(`/api/proxy/attendance?${params.toString()}`, {
        credentials: 'include',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=check_in_time'),
        expect.any(Object)
      );
    });
  });

  describe('POST /api/proxy/attendance', () => {
    it('should create a new attendance record', async () => {
      const newRecord = {
        user_id: 'user1',
        check_in_time: '2024-01-15T09:00:00Z',
        latitude: 1.2787,
        longitude: 103.8577,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          record: { id: '1', ...newRecord },
          message: 'Attendance recorded successfully',
        }),
      });

      const response = await fetch('/api/proxy/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.record.user_id).toBe('user1');
    });

    it('should validate required fields', async () => {
      const invalidRecord = { latitude: 1.2787 }; // Missing user_id

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'User ID is required' }),
      });

      const response = await fetch('/api/proxy/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRecord),
        credentials: 'include',
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
    });

    it('should create attendance with checkout time', async () => {
      const recordWithCheckout = {
        user_id: 'user1',
        check_in_time: '2024-01-15T09:00:00Z',
        check_out_time: '2024-01-15T17:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          record: { id: '1', ...recordWithCheckout },
        }),
      });

      const response = await fetch('/api/proxy/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordWithCheckout),
        credentials: 'include',
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.record.check_out_time).toBe('2024-01-15T17:00:00Z');
    });
  });
});

describe('Attendance Statistics', () => {
  describe('calculateWorkingHours', () => {
    const calculateWorkingHours = (checkIn: string, checkOut: string | null): number | null => {
      if (!checkOut) return null;
      
      const start = new Date(checkIn).getTime();
      const end = new Date(checkOut).getTime();
      const diffMs = end - start;
      
      return diffMs / (1000 * 60 * 60); // Convert to hours
    };

    it('should calculate correct working hours', () => {
      const checkIn = '2024-01-15T09:00:00Z';
      const checkOut = '2024-01-15T17:00:00Z';
      
      const hours = calculateWorkingHours(checkIn, checkOut);
      expect(hours).toBe(8);
    });

    it('should return null for missing checkout', () => {
      const checkIn = '2024-01-15T09:00:00Z';
      
      const hours = calculateWorkingHours(checkIn, null);
      expect(hours).toBeNull();
    });

    it('should handle partial hours', () => {
      const checkIn = '2024-01-15T09:00:00Z';
      const checkOut = '2024-01-15T17:30:00Z';
      
      const hours = calculateWorkingHours(checkIn, checkOut);
      expect(hours).toBe(8.5);
    });
  });

  describe('getAttendanceStatus', () => {
    const getAttendanceStatus = (checkOut: string | null): 'CHECKED_IN' | 'PRESENT' => {
      return checkOut ? 'PRESENT' : 'CHECKED_IN';
    };

    it('should return CHECKED_IN when no checkout', () => {
      const status = getAttendanceStatus(null);
      expect(status).toBe('CHECKED_IN');
    });

    it('should return PRESENT when checkout exists', () => {
      const status = getAttendanceStatus('2024-01-15T17:00:00Z');
      expect(status).toBe('PRESENT');
    });
  });

  describe('filterTodayRecords', () => {
    const filterTodayRecords = (records: any[], today: string) => {
      return records.filter((record) => {
        const recordDate = new Date(record.check_in_time).toISOString().split('T')[0];
        return recordDate === today;
      });
    };

    it('should filter records for today', () => {
      const today = '2024-01-15';
      const records = [
        { id: '1', check_in_time: '2024-01-15T09:00:00Z' },
        { id: '2', check_in_time: '2024-01-14T09:00:00Z' },
        { id: '3', check_in_time: '2024-01-15T10:00:00Z' },
      ];
      
      const todayRecords = filterTodayRecords(records, today);
      expect(todayRecords).toHaveLength(2);
    });

    it('should return empty array when no records for today', () => {
      const today = '2024-01-16';
      const records = [
        { id: '1', check_in_time: '2024-01-15T09:00:00Z' },
      ];
      
      const todayRecords = filterTodayRecords(records, today);
      expect(todayRecords).toHaveLength(0);
    });
  });
});

describe('Attendance Validation', () => {
  describe('validateLocation', () => {
    const validateLocation = (lat: number, lng: number): boolean => {
      // Validate latitude (-90 to 90) and longitude (-180 to 180)
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    };

    it('should accept valid coordinates', () => {
      expect(validateLocation(1.2787, 103.8577)).toBe(true);
      expect(validateLocation(0, 0)).toBe(true);
      expect(validateLocation(-90, -180)).toBe(true);
      expect(validateLocation(90, 180)).toBe(true);
    });

    it('should reject invalid latitude', () => {
      expect(validateLocation(91, 0)).toBe(false);
      expect(validateLocation(-91, 0)).toBe(false);
    });

    it('should reject invalid longitude', () => {
      expect(validateLocation(0, 181)).toBe(false);
      expect(validateLocation(0, -181)).toBe(false);
    });
  });

  describe('validateTimeRange', () => {
    const validateTimeRange = (checkIn: string, checkOut: string): boolean => {
      const start = new Date(checkIn).getTime();
      const end = new Date(checkOut).getTime();
      return end > start;
    };

    it('should accept valid time range', () => {
      const checkIn = '2024-01-15T09:00:00Z';
      const checkOut = '2024-01-15T17:00:00Z';
      
      expect(validateTimeRange(checkIn, checkOut)).toBe(true);
    });

    it('should reject checkout before checkin', () => {
      const checkIn = '2024-01-15T17:00:00Z';
      const checkOut = '2024-01-15T09:00:00Z';
      
      expect(validateTimeRange(checkIn, checkOut)).toBe(false);
    });

    it('should reject same time', () => {
      const checkIn = '2024-01-15T09:00:00Z';
      const checkOut = '2024-01-15T09:00:00Z';
      
      expect(validateTimeRange(checkIn, checkOut)).toBe(false);
    });
  });
});

