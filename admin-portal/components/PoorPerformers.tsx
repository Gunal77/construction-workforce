'use client';

import { useState, useMemo, useEffect } from 'react';
import { Employee, AttendanceRecord, lastEndDateAPI } from '@/lib/api';
import { AlertTriangle } from 'lucide-react';
import Pagination from './Pagination';
import LastEndDateBadge from './LastEndDateBadge';

interface PoorPerformer {
  worker: Employee;
  issues: string[];
  attendance: number;
  priority: 'GOOD' | 'MEDIUM' | 'HIGH';
}

interface PoorPerformersProps {
  workers: Employee[];
  attendanceRecords: AttendanceRecord[];
}

const ITEMS_PER_PAGE = 5;

export default function PoorPerformers({ workers, attendanceRecords }: PoorPerformersProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [lastEndDates, setLastEndDates] = useState<Record<string, string | null>>({});
  const today = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    const fetchLastEndDates = async () => {
      try {
        if (workers.length === 0) return;
        const employeeIds = workers.map(w => w.id);
        const response = await lastEndDateAPI.getAll({ employeeIds });
        const datesMap: Record<string, string | null> = {};
        (response.lastEndDates || []).forEach((item: any) => {
          datesMap[item.employee_id] = item.last_end_date;
        });
        setLastEndDates(datesMap);
      } catch (err) {
        console.error('Error fetching last end dates:', err);
      }
    };
    fetchLastEndDates();
  }, [workers]);
  const todayStart = new Date(today + 'T00:00:00');
  const todayEnd = new Date(today + 'T23:59:59');
  
  // Expected check-in time (e.g., 7:00 AM)
  const expectedCheckInHour = 7;
  const expectedCheckInMinute = 0;

  // Calculate poor performers
  const poorPerformers: PoorPerformer[] = [];

  workers.forEach((worker) => {
    // Match attendance records by email since user_id references users.id, not employees.id
    // Employees and users are linked by email
    const workerRecords = attendanceRecords.filter(
      (r) => worker.email && r.user_email?.toLowerCase() === worker.email.toLowerCase()
    );

    const issues: string[] = [];
    let lateCount = 0;
    let absentCount = 0;
    let presentDays = 0;

    // Check today's attendance
    const todayRecord = workerRecords.find((r) => {
      const recordDate = new Date(r.check_in_time).toISOString().split('T')[0];
      return recordDate === today;
    });

    if (!todayRecord) {
      absentCount++;
      issues.push('Absent today');
    } else {
      const checkInTime = new Date(todayRecord.check_in_time);
      const expectedTime = new Date(todayStart);
      expectedTime.setHours(expectedCheckInHour, expectedCheckInMinute, 0, 0);

      if (checkInTime > expectedTime) {
        lateCount++;
        const hours = checkInTime.getHours();
        const minutes = checkInTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        issues.push(`Late check-in today (${displayHours}:${String(minutes).padStart(2, '0')} ${ampm})`);
      }
    }

    // Calculate weekly stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekRecords = workerRecords.filter(
      (r) => new Date(r.check_in_time) >= weekAgo
    );

    let weekLateCount = 0;
    weekRecords.forEach((record) => {
      const checkInTime = new Date(record.check_in_time);
      const expectedTime = new Date(checkInTime);
      expectedTime.setHours(expectedCheckInHour, expectedCheckInMinute, 0, 0);
      expectedTime.setDate(checkInTime.getDate());

      if (checkInTime > expectedTime) {
        weekLateCount++;
      }
    });

    // Count absences this week
    const weekAbsentCount = 7 - weekRecords.length;
    const weekAbsentDays = weekAbsentCount > 0 ? weekAbsentCount : 0;

    if (weekLateCount > 0) {
      issues.push(`${weekLateCount} late arrival${weekLateCount > 1 ? 's' : ''} this week`);
    }
    if (weekAbsentDays > 0) {
      issues.push(`${weekAbsentDays} absence${weekAbsentDays > 1 ? 's' : ''} this week`);
    }

    // Calculate attendance percentage based on available data range
    // Use the date range of the provided attendance records, or default to 30 days
    let dateRangeStart: Date;
    let dateRangeEnd: Date;
    
    if (workerRecords.length > 0) {
      // Use the actual date range of the provided records
      const allDates = workerRecords.map(r => new Date(r.check_in_time));
      dateRangeStart = new Date(Math.min(...allDates.map(d => d.getTime())));
      dateRangeEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
      
      // Also include today if it's after the last record
      const today = new Date();
      if (today > dateRangeEnd) {
        dateRangeEnd = today;
      }
    } else {
      // If no records, use last 30 days as default
      dateRangeEnd = new Date();
      dateRangeStart = new Date();
      dateRangeStart.setDate(dateRangeStart.getDate() - 30);
    }
    
    // Calculate total working days in the range (excluding weekends if needed, or just count all days)
    const timeDiff = dateRangeEnd.getTime() - dateRangeStart.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    const totalDays = Math.max(daysDiff, 1); // Ensure at least 1 day
    
    // Count unique days with attendance
    const uniqueDays = new Set(
      workerRecords.map((r) => r.check_in_time.split('T')[0])
    );
    presentDays = uniqueDays.size;
    
    // Calculate attendance percentage
    const attendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Determine priority: GOOD (green) for >80% attendance, then MEDIUM, then HIGH
    let priority: 'GOOD' | 'MEDIUM' | 'HIGH' = 'GOOD';
    
    // GOOD priority (Green): Above 80% attendance
    if (attendance > 80) {
      priority = 'GOOD';
    } 
    // MEDIUM priority: 50-80% attendance
    else if (attendance >= 50) {
      priority = 'MEDIUM';
    } 
    // HIGH priority: Below 50% attendance
    else {
      priority = 'HIGH';
    }

    // Include all workers for performance tracking
    poorPerformers.push({
      worker,
      issues,
      attendance,
      priority,
    });
  });

  // Sort by priority: GOOD (green, >75%) first, then MEDIUM, then HIGH
  // Within same priority, sort by attendance (highest first for GOOD, lowest first for others)
  poorPerformers.sort((a, b) => {
    const priorityOrder: { [key: string]: number } = { 'GOOD': 0, 'MEDIUM': 1, 'HIGH': 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    
    if (priorityDiff !== 0) {
      return priorityDiff; // Sort by priority first (GOOD/green first)
    }
    
    // Within same priority: GOOD = highest attendance first, others = lowest attendance first
    if (a.priority === 'GOOD') {
      return b.attendance - a.attendance; // Descending for GOOD (highest first)
    }
    return a.attendance - b.attendance; // Ascending for MEDIUM/HIGH (lowest first)
  });

  // Pagination
  const totalPages = Math.ceil(poorPerformers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPerformers = poorPerformers.slice(startIndex, endIndex);

  if (poorPerformers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-800">
            Performance Overview
          </h3>
        </div>
        {poorPerformers.length > 0 && (
          <span className="text-sm text-gray-600">
            Showing {startIndex + 1} - {Math.min(endIndex, poorPerformers.length)} of {poorPerformers.length} workers
          </span>
        )}
      </div>
      <div className="space-y-3">
        {paginatedPerformers.map((performer) => (
          <div
            key={performer.worker.id}
            className={`p-4 rounded-lg border ${
              performer.priority === 'HIGH'
                ? 'bg-red-50 border-red-200'
                : performer.priority === 'MEDIUM'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      performer.priority === 'HIGH'
                        ? 'text-red-600'
                        : performer.priority === 'MEDIUM'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  />
                  <h4 className="font-semibold text-gray-900">
                    {performer.worker.name}
                  </h4>
                </div>
                <div className="space-y-1">
                  {performer.issues.length > 0 ? (
                    performer.issues.map((issue, idx) => (
                      <p
                        key={idx}
                        className="text-sm text-gray-700"
                      >
                        {issue}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-gray-700">No issues reported</p>
                  )}
                  <p className="text-sm font-medium text-gray-700">
                    Attendance: {performer.attendance}%
                  </p>
                  <div className="mt-2">
                    <span className="text-xs text-gray-500 mr-2">Last End Date:</span>
                    <LastEndDateBadge lastEndDate={lastEndDates[performer.worker.id]} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-2">
                <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  performer.priority === 'HIGH'
                    ? 'bg-red-200 text-red-800'
                    : performer.priority === 'MEDIUM'
                    ? 'bg-yellow-200 text-yellow-800'
                    : 'bg-green-200 text-green-800'
                }`}
                >
                  {performer.priority}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

