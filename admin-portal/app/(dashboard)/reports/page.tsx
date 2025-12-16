'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { attendanceAPI, employeesAPI, projectsAPI, lastEndDateAPI, leaveAPI } from '@/lib/api';
import StatCard from '@/components/StatCard';
import Card from '@/components/Card';
import ProjectReportsTable from '@/components/ProjectReportsTable';
import DateRangeFilter, { DateRange, CompareDateRange } from '@/components/DateRangeFilter';
import LastEndDateBadge from '@/components/LastEndDateBadge';
import LeaveApprovalTable from '@/components/LeaveApprovalTable';
import WorkerAttendanceReportTable from '@/components/WorkerAttendanceReportTable';
import { FolderKanban, Users as UsersIcon, Clock as ClockIcon, DollarSign, Calendar, Filter } from 'lucide-react';
import Pagination from '@/components/Pagination';

interface ReportsData {
  totalProjects: number;
  activeProjects: number;
  totalWorkers: number;
  activeToday: number;
  totalHours: number;
  hoursTrend: number;
  totalBudget: number;
  totalSpent: number;
  budgetUtilization: number;
  projectReports: any[];
}

// Format currency in millions
function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<ReportsData>({
    totalProjects: 0,
    activeProjects: 0,
    totalWorkers: 0,
    activeToday: 0,
    totalHours: 0,
    hoursTrend: 0,
    totalBudget: 0,
    totalSpent: 0,
    budgetUtilization: 0,
    projectReports: [],
  });
  const [fromDate, setFromDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [toDate, setToDate] = useState<Date>(new Date());
  const [compareRange, setCompareRange] = useState<CompareDateRange | undefined>(undefined);
  const [lastEndDates, setLastEndDates] = useState<Record<string, string | null>>({});
  const [inactiveDaysFilter, setInactiveDaysFilter] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [showLeaveSection, setShowLeaveSection] = useState(false);
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [projectReportsPage, setProjectReportsPage] = useState(1);
  const [workerReportsPage, setWorkerReportsPage] = useState(1);
  const [leaveRequestsPage, setLeaveRequestsPage] = useState(1);
  
  const ITEMS_PER_PAGE = 10;

  const fetchReportsData = useCallback(async () => {
    try {
      // Only show full loading on initial load
      if (reportsData.totalProjects === 0) {
        setLoading(true);
      } else {
        // For subsequent filters, show subtle loading
        setLoading(true);
      }
      
      const normalizeDateToStartOfDay = (date: Date) => {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
      };
      
      const normalizeDateToEndOfDay = (date: Date) => {
        const normalized = new Date(date);
        normalized.setHours(23, 59, 59, 999);
        return normalized;
      };
      
      const finalFrom = fromDate <= toDate ? fromDate : toDate;
      const finalTo = toDate >= fromDate ? toDate : fromDate;
      
      const fromDateStr = finalFrom.toISOString().split('T')[0];
      const toDateStr = finalTo.toISOString().split('T')[0];

      const [employeesRes, attendanceRes, projectsRes] = await Promise.all([
        employeesAPI.getAll(),
        attendanceAPI.getAll({
          from: fromDateStr,
          to: toDateStr,
          sortBy: 'check_in_time',
          sortOrder: 'desc',
        }),
        projectsAPI.getAll(),
      ]);

      const workers = employeesRes.employees || [];
      const attendanceRecords = attendanceRes.records || [];
      const projects = projectsRes.projects || [];

      let filteredWorkers = workers;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredWorkers = filteredWorkers.filter((w: any) => {
          const name = w.name?.toLowerCase() || '';
          const email = w.email?.toLowerCase() || '';
          const role = w.role?.toLowerCase() || '';
          return name.includes(query) || email.includes(query) || role.includes(query);
        });
      }
      
      const employeeIds = filteredWorkers.map((w: any) => w.id);
      
      try {
        const lastEndDatesRes = await lastEndDateAPI.getAll({ 
          employeeIds,
          inactiveDays: inactiveDaysFilter || undefined,
        });
        const datesMap: Record<string, string | null> = {};
        (lastEndDatesRes.lastEndDates || []).forEach((item: any) => {
          datesMap[item.employee_id] = item.last_end_date;
        });
        setLastEndDates(datesMap);
        
        if (inactiveDaysFilter !== null) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - inactiveDaysFilter);
          cutoffDate.setHours(0, 0, 0, 0);
          
          filteredWorkers = filteredWorkers.filter((w: any) => {
            const lastEndDate = datesMap[w.id];
            if (!lastEndDate) return true;
            const endDate = new Date(lastEndDate);
            endDate.setHours(0, 0, 0, 0);
            return endDate < cutoffDate;
          });
        }
      } catch (err) {
        console.error('Error fetching last end dates:', err);
      }
      
      setAllWorkers(filteredWorkers);

      // Fetch leave statistics
      try {
        const currentYear = new Date().getFullYear();
        const statsRes = await leaveAPI.getStatistics(currentYear);
        setLeaveStats(statsRes);
        
        const requestsRes = await leaveAPI.getRequests({ year: currentYear });
        setLeaveRequests(requestsRes.requests || []);
      } catch (err) {
        console.error('Error fetching leave data:', err);
      }

      // Calculate statistics for selected date range
      const activeProjects = projects.filter((p: any) => !p.end_date || new Date(p.end_date) > new Date()).length;
      
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = attendanceRecords.filter((record: any) => {
        const recordDate = new Date(record.check_in_time).toISOString().split('T')[0];
        return recordDate === today;
      });
      const activeToday = new Set(todayRecords.map((r: any) => r.user_id)).size;

      // Calculate total hours for selected date range
      // Backend should already filter by date range, but we do client-side filtering as well
      // to ensure accuracy (in case backend filtering has timezone issues)
      const rangeStart = normalizeDateToStartOfDay(finalFrom);
      const rangeEnd = normalizeDateToEndOfDay(finalTo);
      
      const rangeRecords = attendanceRecords.filter((record: any) => {
        if (!record.check_out_time) return false;
        const recordDate = normalizeDateToStartOfDay(new Date(record.check_in_time));
        return rangeStart && rangeEnd && recordDate >= rangeStart && recordDate <= rangeEnd;
      });
      
      const totalHours = rangeRecords.reduce((sum: number, record: any) => {
        const checkIn = new Date(record.check_in_time);
        const checkOut = new Date(record.check_out_time);
        const diff = checkOut.getTime() - checkIn.getTime();
        const hours = diff / (1000 * 60 * 60);
        return sum + hours;
      }, 0);

      // Calculate comparison hours if compare is enabled
      let hoursTrend = 0;
      if (compareRange?.enabled && compareRange.from && compareRange.to) {
        const compareFromDate = compareRange.from.toISOString().split('T')[0];
        const compareToDate = compareRange.to.toISOString().split('T')[0];
        
        const compareAttendanceRes = await attendanceAPI.getAll({
          from: compareFromDate,
          to: compareToDate,
        });
        
        const compareStart = compareRange.from ? normalizeDateToStartOfDay(compareRange.from) : null;
        const compareEnd = compareRange.to ? normalizeDateToEndOfDay(compareRange.to) : null;
        
        const compareRecords = (compareAttendanceRes.records || []).filter((record: any) => {
          if (!record.check_out_time) return false;
          const recordDate = normalizeDateToStartOfDay(new Date(record.check_in_time));
          return compareStart && compareEnd && recordDate >= compareStart && recordDate <= compareEnd;
        });
        
        const compareHours = compareRecords.reduce((sum: number, record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = new Date(record.check_out_time);
          const diff = checkOut.getTime() - checkIn.getTime();
          const hours = diff / (1000 * 60 * 60);
          return sum + hours;
        }, 0);

        hoursTrend = compareHours > 0 
          ? ((totalHours - compareHours) / compareHours) * 100 
          : 0;
      } else {
        // Compare with previous period (same duration before selected range)
        const duration = finalTo.getTime() - finalFrom.getTime();
        const prevTo = new Date(finalFrom.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - duration);
        
        const prevFromDate = prevFrom.toISOString().split('T')[0];
        const prevToDate = prevTo.toISOString().split('T')[0];
        
        const prevAttendanceRes = await attendanceAPI.getAll({
          from: prevFromDate,
          to: prevToDate,
        });
        
        const prevStart = normalizeDateToStartOfDay(prevFrom);
        const prevEnd = normalizeDateToEndOfDay(prevTo);
        
        const prevRecords = (prevAttendanceRes.records || []).filter((record: any) => {
          if (!record.check_out_time) return false;
          const recordDate = normalizeDateToStartOfDay(new Date(record.check_in_time));
          return recordDate >= prevStart && recordDate <= prevEnd;
        });
        
        const prevHours = prevRecords.reduce((sum: number, record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = new Date(record.check_out_time);
          const diff = checkOut.getTime() - checkIn.getTime();
          const hours = diff / (1000 * 60 * 60);
          return sum + hours;
        }, 0);

        hoursTrend = prevHours > 0 
          ? ((totalHours - prevHours) / prevHours) * 100 
          : 0;
      }

      // Calculate total budget
      let totalBudget = 0;
      let totalSpent = 0;
      projects.forEach((project: any) => {
        if (project.budget) {
          totalBudget += typeof project.budget === 'string' ? parseFloat(project.budget) : project.budget;
        }
        // Estimate spent based on completion if available
        if (project.budget && project.completion) {
          const budget = typeof project.budget === 'string' ? parseFloat(project.budget) : project.budget;
          totalSpent += budget * (project.completion / 100);
        }
      });

      const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      // Create a map of user emails to employee project IDs for efficient lookup
      const emailToProjectMap: Record<string, string> = {};
      workers.forEach((w: any) => {
        if (w.email && w.project_id) {
          emailToProjectMap[w.email.toLowerCase()] = w.project_id;
        }
      });

      const projectReports = projects.map((project: any) => {
        const projectWorkers = filteredWorkers.filter((w: any) => w.project_id === project.id);
        // Match attendance records by email (attendance has user_email, employees have email)
        const projectRecords = rangeRecords.filter((r: any) => {
          if (!r.user_email) return false;
          const recordEmail = r.user_email.toLowerCase();
          return emailToProjectMap[recordEmail] === project.id;
        });
        
        const projectHours = projectRecords.reduce((sum: number, record: any) => {
          const checkIn = new Date(record.check_in_time);
          const checkOut = new Date(record.check_out_time);
          const diff = checkOut.getTime() - checkIn.getTime();
          return sum + (diff / (1000 * 60 * 60));
        }, 0);

        // Determine status
        let status = 'ACTIVE';
        if (project.end_date && new Date(project.end_date) <= new Date()) {
          status = 'COMPLETED';
        } else if (project.status === 'on_hold' || project.status === 'ON HOLD') {
          status = 'ON HOLD';
        }

        // Calculate completion percentage
        let completion = null;
        if (project.end_date && project.start_date) {
          const start = new Date(project.start_date);
          const end = new Date(project.end_date);
          const now = new Date();
          const totalDuration = end.getTime() - start.getTime();
          const elapsed = now.getTime() - start.getTime();
          if (totalDuration > 0) {
            completion = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          }
        } else if (status === 'COMPLETED') {
          completion = 100;
        }

        // Calculate spent (estimate based on completion or use actual if available)
        let spent = null;
        if (project.budget) {
          const budget = typeof project.budget === 'string' ? parseFloat(project.budget) : project.budget;
          if (completion !== null) {
            spent = budget * (completion / 100);
          } else if (project.spent) {
            spent = typeof project.spent === 'string' ? parseFloat(project.spent) : project.spent;
          }
        }

        return {
          id: project.id,
          name: project.name,
          startDate: project.start_date,
          status,
          workers: projectWorkers.length,
          totalHours: Math.round(projectHours),
          budget: project.budget ? (typeof project.budget === 'string' ? parseFloat(project.budget) : project.budget) : null,
          spent,
          completion: completion ? Math.round(completion) : null,
        };
      });

      setReportsData({
        totalProjects: projects.length,
        activeProjects,
        totalWorkers: filteredWorkers.length,
        activeToday,
        totalHours: Math.round(totalHours),
        hoursTrend,
        totalBudget,
        totalSpent,
        budgetUtilization,
        projectReports,
      });
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, inactiveDaysFilter, searchQuery, compareRange]);

  useEffect(() => {
    // Store scroll position before fetching
    const scrollPosition = window.scrollY;
    
    fetchReportsData();
    
    // Restore scroll position after a brief delay to prevent scroll reset
    const timeoutId = setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [fetchReportsData]);

  const handleDateRangeChange = useCallback((range: DateRange, compare?: CompareDateRange) => {
    // Store scroll position to restore after update
    const scrollPosition = window.scrollY;
    
    // Update state
    if (range.from) setFromDate(range.from);
    if (range.to) setToDate(range.to);
    setCompareRange(compare);
    setProjectReportsPage(1);
    setWorkerReportsPage(1);
    setLeaveRequestsPage(1);
    
    // Restore scroll position after a brief delay
    setTimeout(() => {
      window.scrollTo(0, scrollPosition);
    }, 100);
  }, []);

  const getTrendLabel = () => {
    if (compareRange?.enabled) {
      if (compareRange.type === 'previous-year') {
        return 'vs previous year';
      } else if (compareRange.type === 'previous-month') {
        return 'vs previous month';
      } else {
        return 'vs comparison period';
      }
    }
    return 'vs previous period';
  };

  // Paginated Project Reports
  const paginatedProjectReports = useMemo(() => {
    const startIndex = (projectReportsPage - 1) * ITEMS_PER_PAGE;
    return reportsData.projectReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [reportsData.projectReports, projectReportsPage]);
  const projectReportsTotalPages = Math.ceil(reportsData.projectReports.length / ITEMS_PER_PAGE);

  // Paginated Workers
  const paginatedWorkers = useMemo(() => {
    const startIndex = (workerReportsPage - 1) * ITEMS_PER_PAGE;
    return allWorkers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allWorkers, workerReportsPage]);
  const workerReportsTotalPages = Math.ceil(allWorkers.length / ITEMS_PER_PAGE);

  // Paginated Leave Requests
  const pendingLeaveRequests = useMemo(() => {
    return leaveRequests.filter((r: any) => r.status === 'pending');
  }, [leaveRequests]);
  const paginatedLeaveRequests = useMemo(() => {
    const startIndex = (leaveRequestsPage - 1) * ITEMS_PER_PAGE;
    return pendingLeaveRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [pendingLeaveRequests, leaveRequestsPage]);
  const leaveRequestsTotalPages = Math.ceil(pendingLeaveRequests.length / ITEMS_PER_PAGE);

  // Show loading overlay instead of replacing entire page
  if (loading && reportsData.totalProjects === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 w-full max-w-full overflow-x-hidden relative">
      {/* Loading Overlay */}
      {loading && reportsData.totalProjects > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 z-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <div className="text-sm text-gray-600">Updating reports...</div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">Reports & Analytics</h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">Comprehensive project, attendance, and performance reports</p>
      </div>

      {/* Date Range Filter */}
      <div className="w-full max-w-full">
        <DateRangeFilter onDateRangeChange={handleDateRangeChange} />
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full max-w-full">
        <StatCard
          title="Total Projects"
          value={reportsData.totalProjects}
          subtitle={`${reportsData.activeProjects} Active`}
          icon={<FolderKanban className="h-6 w-6 text-blue-600" />}
        />
        <StatCard
          title="Total Workers"
          value={reportsData.totalWorkers}
          subtitle={`${reportsData.activeToday} Active Today`}
          icon={<UsersIcon className="h-6 w-6 text-green-600" />}
        />
        <StatCard
          title="Total Hours"
          value={reportsData.totalHours.toLocaleString()}
          subtitle={reportsData.hoursTrend !== 0 ? (
            <span className={reportsData.hoursTrend > 0 ? 'text-green-600' : 'text-red-600'}>
              {reportsData.hoursTrend > 0 ? '+' : ''}{reportsData.hoursTrend.toFixed(1)}% {getTrendLabel()}
            </span>
          ) : undefined}
          icon={<ClockIcon className="h-6 w-6 text-orange-600" />}
        />
        <StatCard
          title="Total Budget"
          value={reportsData.totalBudget > 0 ? formatCurrency(reportsData.totalBudget) : '$0'}
          subtitle={reportsData.totalBudget > 0 ? `${reportsData.budgetUtilization.toFixed(1)}% utilized` : undefined}
          icon={<DollarSign className="h-6 w-6 text-red-600" />}
        />
      </div>

      <Card title="Project Reports">
        <div className="space-y-4">
          {reportsData.projectReports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No data found for selected filters</div>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                Showing {((projectReportsPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(projectReportsPage * ITEMS_PER_PAGE, reportsData.projectReports.length)} of {reportsData.projectReports.length} projects
              </div>
              <ProjectReportsTable data={paginatedProjectReports} />
              {projectReportsTotalPages > 1 && (
                <Pagination
                  currentPage={projectReportsPage}
                  totalPages={projectReportsTotalPages}
                  onPageChange={setProjectReportsPage}
                />
              )}
            </>
          )}
        </div>
      </Card>

      {/* Worker Attendance Report with Last End Dates */}
      <Card title="Worker Attendance Report">
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setWorkerReportsPage(1);
            }}
            placeholder="Search by name, email, or role..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="mb-4">
          <select
            value={inactiveDaysFilter || ''}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value, 10) : null;
              setInactiveDaysFilter(value);
              setWorkerReportsPage(1);
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Workers</option>
            <option value="1">Inactive 1+ days</option>
            <option value="3">Inactive 3+ days</option>
            <option value="7">Inactive 7+ days</option>
            <option value="14">Inactive 14+ days</option>
            <option value="30">Inactive 30+ days</option>
          </select>
        </div>
        {allWorkers.length === 0 && !loading ? (
          <div className="text-center py-8 text-gray-500">
            No data found for selected filters
          </div>
        ) : (
          <WorkerAttendanceReportTable
            workers={allWorkers}
            lastEndDates={lastEndDates}
            currentPage={workerReportsPage}
            onPageChange={setWorkerReportsPage}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </Card>

      {/* Leave Management Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-800">Leave Management</h2>
          </div>
          <button
            onClick={() => setShowLeaveSection(!showLeaveSection)}
            className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            {showLeaveSection ? 'Hide' : 'Show'} Leave Reports
          </button>
        </div>

        {showLeaveSection && (
          <div className="space-y-6">
            {/* Leave Statistics */}
            {leaveStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <p className="text-sm text-yellow-600 font-medium mb-1">Pending Requests</p>
                  <p className="text-2xl font-bold text-yellow-900">{leaveStats.pendingCount || 0}</p>
                </div>
                {leaveStats.usageByType && leaveStats.usageByType.length > 0 && (
                  <>
                    {leaveStats.usageByType.map((type: any) => (
                      <div key={type.leave_type_code} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-sm text-blue-600 font-medium mb-1">{type.leave_type_name}</p>
                        <p className="text-2xl font-bold text-blue-900">{type.total_days || 0}</p>
                        <p className="text-xs text-blue-600 mt-1">{type.request_count} requests</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Leave Requests Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Leave Requests</h3>
              <LeaveApprovalTable
                requests={pendingLeaveRequests}
                currentPage={leaveRequestsPage}
                onPageChange={setLeaveRequestsPage}
                itemsPerPage={ITEMS_PER_PAGE}
                onUpdate={() => {
                  const currentYear = new Date().getFullYear();
                  leaveAPI.getRequests({ year: currentYear }).then((res) => {
                    setLeaveRequests(res.requests || []);
                    setLeaveRequestsPage(1); // Reset to first page after update
                  });
                  leaveAPI.getStatistics(currentYear).then((res) => {
                    setLeaveStats(res);
                  });
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
