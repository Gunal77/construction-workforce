'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { timesheetAPI, employeesAPI, projectsAPI, Timesheet, Employee, Project } from '@/lib/api';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import SearchableSelect from '@/components/SearchableSelect';
import { Plus, Search, CheckCircle2, XCircle, Calendar, Clock, FileText, CalendarDays, Eye, Download, AlertCircle, FileSpreadsheet } from 'lucide-react';
import Pagination from '@/components/Pagination';
import ViewTimesheetModal from '@/components/ViewTimesheetModal';

const ITEMS_PER_PAGE = 10;

type ViewType = 'daily' | 'week' | 'month';

export default function TimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [employeeProjects, setEmployeeProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [view, setView] = useState<ViewType>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAllData, setShowAllData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    staffId: '',
    workDate: new Date().toISOString().split('T')[0],
    checkIn: '',
    checkOut: '',
    projectId: '',
    taskType: '',
    status: 'Present' as 'Present' | 'Absent' | 'Half-Day',
    remarks: '',
  });

  useEffect(() => {
    // Fetch employees and projects in parallel for faster loading
    Promise.all([
      fetchEmployees(),
      fetchProjects(),
    ]);
  }, []);

  useEffect(() => {
    fetchTimesheets();
    setCurrentPage(1);
  }, [view, currentDate, statusFilter, approvalStatusFilter, projectFilter, employeeFilter, showAllData]);

  const fetchEmployees = async () => {
    try {
      const response = await employeesAPI.getAll();
      setEmployees(response.employees || []);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
    }
  };

  const getDateRange = useCallback(() => {
    const date = new Date(currentDate);
    if (view === 'daily') {
      return {
        startDate: date.toISOString().split('T')[0],
        endDate: date.toISOString().split('T')[0],
      };
    } else if (view === 'week') {
      const day = date.getDay();
      const diff = date.getDate() - day;
      const start = new Date(date.setDate(diff));
      const end = new Date(date.setDate(diff + 6));
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
  }, [view, currentDate]);

  const fetchTimesheets = async () => {
    try {
      setLoading(true);
      const params: any = {
        view,
      };
      
      // Only add date filters if not showing all data
      if (!showAllData) {
        const { startDate, endDate } = getDateRange();
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (dateRangeStart && dateRangeEnd) {
        // Use custom date range if provided
        params.startDate = dateRangeStart;
        params.endDate = dateRangeEnd;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (approvalStatusFilter !== 'all') {
        params.approvalStatus = approvalStatusFilter;
      }
      if (projectFilter && projectFilter !== 'all') {
        params.projectId = projectFilter;
      }
      if (employeeFilter) {
        params.staffId = employeeFilter;
      }

      const response = await timesheetAPI.getTimesheets(params);
      setTimesheets(response.timesheets || []);
      if (response.timesheets?.length === 0 && !showAllData) {
        // If no data found for current date range, suggest showing all
        setError('');
      }
    } catch (err: any) {
      console.error('Error fetching timesheets:', err);
      setError(err.response?.data?.message || 'Failed to fetch timesheets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimesheet = async () => {
    try {
      setError('');
      if (!formData.staffId || !formData.workDate || !formData.checkIn) {
        setError('Staff, work date, and check-in time are required');
        return;
      }

      // Format check-in and check-out with date
      const workDate = formData.workDate;
      const checkIn = `${workDate}T${formData.checkIn}:00`;
      const checkOut = formData.checkOut ? `${workDate}T${formData.checkOut}:00` : undefined;

      await timesheetAPI.createTimesheet({
        staffId: formData.staffId,
        workDate,
        checkIn,
        checkOut,
        projectId: formData.projectId || undefined,
        taskType: formData.taskType || undefined,
        status: formData.status,
        remarks: formData.remarks || undefined,
      });

      setSuccessMessage('Timesheet created successfully!');
      setIsFormModalOpen(false);
      resetForm();
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create timesheet');
    }
  };

  const handleUpdateTimesheet = async () => {
    if (!selectedTimesheet) return;
    try {
      setError('');
      const workDate = formData.workDate;
      const checkIn = `${workDate}T${formData.checkIn}:00`;
      const checkOut = formData.checkOut ? `${workDate}T${formData.checkOut}:00` : undefined;

      await timesheetAPI.updateTimesheet(selectedTimesheet.id, {
        workDate,
        checkIn,
        checkOut,
        projectId: formData.projectId || undefined,
        taskType: formData.taskType || undefined,
        status: formData.status,
        remarks: formData.remarks || undefined,
      });

      setSuccessMessage('Timesheet updated successfully!');
      setIsFormModalOpen(false);
      setSelectedTimesheet(null);
      resetForm();
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update timesheet');
    }
  };

  const handleSubmitTimesheet = async (id: string) => {
    try {
      await timesheetAPI.submitTimesheet(id);
      setSuccessMessage('Timesheet submitted for approval');
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit timesheet');
    }
  };

  const handleApproveTimesheet = async (id: string) => {
    try {
      await timesheetAPI.approveTimesheet(id);
      setSuccessMessage('Timesheet approved successfully!');
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve timesheet');
    }
  };

  const handleRejectTimesheet = async (id: string, reason: string) => {
    try {
      await timesheetAPI.rejectTimesheet(id, reason);
      setSuccessMessage('Timesheet rejected');
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject timesheet');
    }
  };

  const handleApproveOT = async (id: string) => {
    try {
      await timesheetAPI.approveOT(id);
      setSuccessMessage('Overtime approved successfully!');
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve overtime');
    }
  };

  const handleRejectOT = async (id: string, reason: string) => {
    try {
      await timesheetAPI.rejectOT(id, reason);
      setSuccessMessage('Overtime rejected');
      fetchTimesheets();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject overtime');
    }
  };

  // Helper function to safely convert to number
  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  const resetForm = () => {
    setFormData({
      staffId: '',
      workDate: new Date().toISOString().split('T')[0],
      checkIn: '',
      checkOut: '',
      projectId: '',
      taskType: '',
      status: 'Present',
      remarks: '',
    });
  };

  const fetchEmployeeProjects = async (employeeId: string) => {
    try {
      const response = await projectsAPI.getEmployeeProjects(employeeId);
      setEmployeeProjects(response.projects || []);
    } catch (err) {
      console.error('Error fetching employee projects:', err);
      setEmployeeProjects([]);
    }
  };

  const openEditModal = (timesheet: Timesheet) => {
    if (timesheet.approval_status === 'Approved') {
      setError('Cannot edit approved timesheet');
      return;
    }
    setSelectedTimesheet(timesheet);
    const checkInTime = timesheet.check_in.split('T')[1]?.slice(0, 5) || '';
    const checkOutTime = timesheet.check_out?.split('T')[1]?.slice(0, 5) || '';
    setFormData({
      staffId: timesheet.staff_id,
      workDate: timesheet.work_date,
      checkIn: checkInTime,
      checkOut: checkOutTime,
      projectId: timesheet.project_id || '',
      taskType: timesheet.task_type || '',
      status: timesheet.status,
      remarks: timesheet.remarks || '',
    });
    if (timesheet.staff_id) {
      fetchEmployeeProjects(timesheet.staff_id);
    }
    setIsFormModalOpen(true);
  };

  const openApprovalModal = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsApprovalModalOpen(true);
  };

  const openViewModal = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsViewModalOpen(true);
  };

  const filteredTimesheets = useMemo(() => {
    let filtered = timesheets;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.staff_name.toLowerCase().includes(query) ||
          t.staff_email.toLowerCase().includes(query) ||
          t.project_name?.toLowerCase().includes(query) ||
          t.task_type?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [timesheets, searchQuery]);

  const paginatedTimesheets = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTimesheets.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTimesheets, currentPage]);

  const totalPages = Math.ceil(filteredTimesheets.length / ITEMS_PER_PAGE);

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'Present':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'Absent':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'Half-Day':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getApprovalStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'Approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'Rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'Submitted':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getOTBadge = (otHours: number | string, otStatus?: string) => {
    const otHoursNum = toNumber(otHours);
    if (otHoursNum <= 0) return null;
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    if (otStatus === 'Approved') {
      return <span className={`${baseClasses} bg-green-100 text-green-800`}>OT: {otHoursNum.toFixed(2)}h ✓</span>;
    } else if (otStatus === 'Rejected') {
      return <span className={`${baseClasses} bg-red-100 text-red-800`}>OT: {otHoursNum.toFixed(2)}h ✗</span>;
    } else if (otStatus === 'Pending') {
      return <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>OT: {otHoursNum.toFixed(2)}h ⏳</span>;
    }
    return <span className={`${baseClasses} bg-blue-100 text-blue-800`}>OT: {otHoursNum.toFixed(2)}h</span>;
  };

  const columns = [
    {
      key: 'staff',
      header: 'Staff',
      render: (item: Timesheet) => (
        <div>
          <span className="font-medium text-gray-900">{item.staff_name}</span>
          <p className="text-xs text-gray-500">{item.staff_email}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: Timesheet) => {
        const date = new Date(item.work_date);
        const day = date.getDate();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return (
          <span className="text-sm text-gray-900">
            {`${day}/${month}/${year}`}
          </span>
        );
      },
    },
    {
      key: 'time',
      header: 'Time',
      render: (item: Timesheet) => {
        const regularHours = Math.min(toNumber(item.total_hours), 8);
        const otHours = toNumber(item.overtime_hours);
        const totalHours = toNumber(item.total_hours);
        return (
          <div className="text-sm">
            <p className="text-gray-900">
              {new Date(item.check_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {item.check_out && ` - ${new Date(item.check_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-blue-600 font-medium">{regularHours.toFixed(2)}h</p>
              {otHours > 0 && (
                <>
                  <span className="text-xs text-gray-400">+</span>
                  <p className="text-xs text-orange-600 font-medium">{otHours.toFixed(2)}h OT</p>
                </>
              )}
              <span className="text-xs text-gray-400">=</span>
              <p className="text-xs text-gray-700 font-semibold">{totalHours.toFixed(2)}h</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'project',
      header: 'Project',
      render: (item: Timesheet) => (
        <span className="text-sm text-gray-900">{item.project_name || 'N/A'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Timesheet) => (
        <span className={getStatusBadge(item.status)}>{item.status}</span>
      ),
    },
    {
      key: 'approval',
      header: 'Approval',
      render: (item: Timesheet) => (
        <span className={getApprovalStatusBadge(item.approval_status)}>
          {item.approval_status}
        </span>
      ),
    },
    {
      key: 'ot',
      header: 'Overtime',
      render: (item: Timesheet) => getOTBadge(item.overtime_hours, item.ot_approval_status),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Timesheet) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openViewModal(item)}
            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          {item.approval_status !== 'Approved' && (
            <button
              onClick={() => openEditModal(item)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          {item.approval_status === 'Draft' && (
            <button
              onClick={() => handleSubmitTimesheet(item.id)}
              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
              title="Submit"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          )}
          {item.approval_status === 'Submitted' && (
            <>
              <button
                onClick={() => handleApproveTimesheet(item.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => openApprovalModal(item)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {toNumber(item.overtime_hours) > 0 && item.ot_approval_status === 'Pending' && (
            <>
              <button
                onClick={() => handleApproveOT(item.id)}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Approve OT"
              >
                <Clock className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const reason = prompt('Enter rejection reason for OT:');
                  if (reason) handleRejectOT(item.id, reason);
                }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Reject OT"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      setError('');
      
      const params = new URLSearchParams();
      if (dateRangeStart) params.append('startDate', dateRangeStart);
      if (dateRangeEnd) params.append('endDate', dateRangeEnd);
      if (employeeFilter) params.append('staffId', employeeFilter);
      if (projectFilter && projectFilter !== 'all') params.append('projectId', projectFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (approvalStatusFilter !== 'all') params.append('approvalStatus', approvalStatusFilter);
      
      const response = await fetch(`/api/proxy/export/timesheet/pdf?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to export PDF' }));
        throw new Error(errorData.error || errorData.message || 'Failed to export PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = dateRangeStart && dateRangeEnd ? `${dateRangeStart}_to_${dateRangeEnd}` : new Date().toISOString().split('T')[0];
      a.download = `timesheet-report-${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      setError('');
      
      const params = new URLSearchParams();
      if (dateRangeStart) params.append('startDate', dateRangeStart);
      if (dateRangeEnd) params.append('endDate', dateRangeEnd);
      if (employeeFilter) params.append('staffId', employeeFilter);
      if (projectFilter && projectFilter !== 'all') params.append('projectId', projectFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (approvalStatusFilter !== 'all') params.append('approvalStatus', approvalStatusFilter);
      
      const response = await fetch(`/api/proxy/export/timesheet/excel?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to export Excel' }));
        throw new Error(errorData.error || errorData.message || 'Failed to export Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = dateRangeStart && dateRangeEnd ? `${dateRangeStart}_to_${dateRangeEnd}` : new Date().toISOString().split('T')[0];
      a.download = `timesheet-report-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to export Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Employee', 'Email', 'Date', 'Check In', 'Check Out', 'Regular Hours', 'OT Hours', 'Total Hours', 'Project', 'Status', 'Approval Status', 'OT Approval'];
    const rows = filteredTimesheets.map(t => {
      const regularHours = Math.min(toNumber(t.total_hours), 8);
      const otHours = toNumber(t.overtime_hours);
      const checkInTime = new Date(t.check_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const checkOutTime = t.check_out ? new Date(t.check_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      const date = formatDate(new Date(t.work_date));
      return [
        t.staff_name,
        t.staff_email,
        date,
        checkInTime,
        checkOutTime,
        regularHours.toFixed(2),
        otHours.toFixed(2),
        toNumber(t.total_hours).toFixed(2),
        t.project_name || 'N/A',
        t.status,
        t.approval_status,
        t.ot_approval_status || 'N/A'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timesheets_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMessage('Timesheets exported successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (view === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  // Helper function to format date consistently (avoid hydration mismatch)
  const formatDate = (date: Date, options?: { weekday?: boolean; year?: boolean; month?: boolean; day?: boolean }) => {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const weekday = weekdays[date.getDay()];
    
    if (options?.weekday && options?.year && options?.month && options?.day) {
      return `${weekday} ${day} ${month} ${year}`;
    } else if (options?.year && options?.month) {
      return `${month} ${year}`;
    } else {
      return `${day}/${String(date.getMonth() + 1).padStart(2, '0')}/${year}`;
    }
  };

  const getViewTitle = () => {
    const date = new Date(currentDate);
    if (view === 'daily') {
      return formatDate(date, { weekday: true, year: true, month: true, day: true });
    } else if (view === 'week') {
      const { startDate, endDate } = getDateRange();
      return `${formatDate(new Date(startDate))} - ${formatDate(new Date(endDate))}`;
    } else {
      return formatDate(date, { year: true, month: true });
    }
  };

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || filteredTimesheets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            title="Export to PDF"
          >
            <Download className={`h-4 w-4 ${isExportingPDF ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || filteredTimesheets.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            title="Export to Excel"
          >
            <FileSpreadsheet className={`h-4 w-4 ${isExportingExcel ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setSelectedTimesheet(null);
              setEmployeeProjects([]);
              setIsFormModalOpen(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            <span>Add Timesheet</span>
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* View Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 min-w-0 max-w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setView('daily');
                setShowAllData(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'daily' && !showAllData ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => {
                setView('week');
                setShowAllData(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'week' && !showAllData ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => {
                setView('month');
                setShowAllData(false);
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                view === 'month' && !showAllData ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => {
                setShowAllData(true);
                setView('daily');
              }}
              className={`px-4 py-2 rounded-lg transition-colors ${
                showAllData ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateDate('prev')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              ←
            </button>
            <span className="text-sm font-medium text-gray-900 min-w-[200px] text-center">
              {showAllData ? 'All Timesheets' : getViewTitle()}
            </span>
            <button
              onClick={() => navigateDate('next')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              →
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Compact Filters - Single Row */}
        <div className="flex flex-wrap items-end gap-3 min-w-0">
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <Input
              type="text"
              placeholder="Search by name, email, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={Search}
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[240px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => {
                setDateRangeStart(e.target.value);
                if (e.target.value && !dateRangeEnd) {
                  setDateRangeEnd(e.target.value);
                }
                setShowAllData(false);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[240px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => {
                setDateRangeEnd(e.target.value);
                setShowAllData(false);
                setCurrentPage(1);
              }}
              min={dateRangeStart}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
            <SearchableSelect
              options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.email})` }))}
              value={employeeFilter}
              onChange={(value) => {
                setEmployeeFilter(value);
                setCurrentPage(1);
              }}
              placeholder="All Employees"
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[150px] sm:max-w-[180px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[130px] sm:max-w-[160px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Half-Day">Half-Day</option>
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[140px] sm:max-w-[170px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Approval</label>
            <select
              value={approvalStatusFilter}
              onChange={(e) => {
                setApprovalStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Approval</option>
              <option value="Draft">Draft</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && timesheets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {timesheets.reduce((sum, t) => sum + toNumber(t.total_hours), 0).toFixed(2)}h
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total OT Hours</p>
                <p className="text-2xl font-bold text-orange-600">
                  {timesheets.reduce((sum, t) => sum + toNumber(t.overtime_hours), 0).toFixed(2)}h
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {timesheets.filter(t => t.approval_status === 'Approved').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {timesheets.filter(t => t.approval_status === 'Submitted' || t.approval_status === 'Draft').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timesheet Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading timesheets...</div>
        </div>
      ) : (
        <>
          {timesheets.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-500 mb-4">No timesheets found</p>
              {!showAllData && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Try selecting a different date or view all timesheets</p>
                  <button
                    onClick={() => setShowAllData(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Show All Timesheets
                  </button>
                </div>
              )}
              {showAllData && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">No timesheets exist in the system yet</p>
                  <button
                    onClick={() => {
                      resetForm();
                      setSelectedTimesheet(null);
                      setIsFormModalOpen(true);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create First Timesheet
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="w-full max-w-full min-w-0 overflow-x-auto">
                <Table
                  columns={columns}
                  data={paginatedTimesheets}
                  keyExtractor={(item) => item.id}
                  emptyMessage="No timesheets found"
                />
              </div>
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Create/Edit Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedTimesheet(null);
          resetForm();
        }}
        title={selectedTimesheet ? 'Edit Timesheet' : 'Create Timesheet'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff *</label>
            <SearchableSelect
              options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.email})` }))}
              value={formData.staffId}
              onChange={(value) => {
                setFormData({ ...formData, staffId: value, projectId: '' });
                if (value) {
                  fetchEmployeeProjects(value);
                } else {
                  setEmployeeProjects([]);
                }
              }}
              placeholder="Select staff"
              disabled={!!selectedTimesheet}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Work Date *</label>
            <Input
              type="date"
              value={formData.workDate}
              onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check In *</label>
              <Input
                type="time"
                value={formData.checkIn}
                onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Check Out</label>
              <Input
                type="time"
                value={formData.checkOut}
                onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
            {formData.staffId ? (
              <>
                <SearchableSelect
                  options={employeeProjects.length > 0 
                    ? employeeProjects.map((p) => ({ value: p.id, label: p.name }))
                    : projects.map((p) => ({ value: p.id, label: p.name }))
                  }
                  value={formData.projectId}
                  onChange={(value) => setFormData({ ...formData, projectId: value })}
                  placeholder="Select project"
                />
                {employeeProjects.length === 0 && formData.staffId && (
                  <p className="text-xs text-yellow-600 mt-1">No assigned projects found. Showing all projects.</p>
                )}
              </>
            ) : (
              <SearchableSelect
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
                value={formData.projectId}
                onChange={(value) => setFormData({ ...formData, projectId: value })}
                placeholder="Select employee first"
                disabled={true}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Type</label>
            <Input
              type="text"
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
              placeholder="e.g., Construction, Maintenance"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Half-Day">Half-Day</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsFormModalOpen(false);
                setSelectedTimesheet(null);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={selectedTimesheet ? handleUpdateTimesheet : handleCreateTimesheet}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {selectedTimesheet ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedTimesheet(null);
        }}
        title="Reject Timesheet"
      >
        {selectedTimesheet && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Staff:</span>
                <span className="text-sm text-gray-900">{selectedTimesheet.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Date:</span>
                <span className="text-sm text-gray-900">
                  {(() => {
                    const date = new Date(selectedTimesheet.work_date);
                    const day = date.getDate();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Hours:</span>
                <span className="text-sm text-gray-900">{toNumber(selectedTimesheet.total_hours).toFixed(2)}h</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rejection Reason *</label>
              <textarea
                id="rejection-reason"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsApprovalModalOpen(false);
                  setSelectedTimesheet(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const reason = (document.getElementById('rejection-reason') as HTMLTextAreaElement).value;
                  if (reason.trim()) {
                    handleRejectTimesheet(selectedTimesheet.id, reason);
                    setIsApprovalModalOpen(false);
                    setSelectedTimesheet(null);
                  } else {
                    setError('Rejection reason is required');
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reject Timesheet
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Timesheet Modal */}
      <ViewTimesheetModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedTimesheet(null);
        }}
        timesheet={selectedTimesheet}
      />
    </div>
  );
}

