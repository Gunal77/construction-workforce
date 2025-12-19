'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { leaveAPI, employeesAPI, LeaveRequest, LeaveType, LeaveBalance } from '@/lib/api';
import Card from '@/components/Card';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import LeaveApprovalTable from '@/components/LeaveApprovalTable';
import LeaveBalanceCard from '@/components/LeaveBalanceCard';
import { Calendar, Plus, CheckCircle2, XCircle, Clock, Download, FileSpreadsheet, CheckSquare } from 'lucide-react';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';

export default function LeaveManagementPage() {
  const searchParams = useSearchParams();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<{ id: string; name: string } | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedEmployeeBalance, setSelectedEmployeeBalance] = useState<LeaveBalance[]>([]);
  // Initialize filterStatus from URL query parameter if present
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [selectedLeaveIds, setSelectedLeaveIds] = useState<string[]>([]);
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const ITEMS_PER_PAGE = 10;

  // Sync filter status with URL parameter
  useEffect(() => {
    const statusParam = searchParams?.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, [filterStatus, currentYear, currentMonth]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [requestsRes, typesRes, employeesRes] = await Promise.all([
        leaveAPI.getRequests({ 
          status: filterStatus === 'all' ? undefined : filterStatus, 
          year: currentYear,
          month: currentMonth || undefined,
        }),
        leaveAPI.getTypes(),
        employeesAPI.getAll(),
      ]);

      setLeaveRequests(requestsRes.requests || []);
      setLeaveTypes(typesRes.leaveTypes || []);
      setEmployees(employeesRes.employees || []);
    } catch (err: any) {
      console.error('Error fetching leave data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      setSelectedEmployee({ id: employeeId, name: employee.name });
      try {
        const balanceRes = await leaveAPI.getBalance(employeeId, currentYear);
        setSelectedEmployeeBalance(balanceRes.balances || []);
      } catch (err) {
        console.error('Error fetching leave balance:', err);
      }
    }
  };

  const handleRequestSuccess = () => {
    fetchData();
    if (selectedEmployee) {
      handleEmployeeSelect(selectedEmployee.id);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (currentYear) params.append('year', currentYear.toString());
      if (currentMonth) params.append('month', currentMonth.toString());
      
      const response = await fetch(`/api/proxy/export/leave/pdf?${params.toString()}`, {
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
      const filename = `leave-report-${currentYear}${currentMonth ? `-${currentMonth}` : ''}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export PDF error:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (currentYear) params.append('year', currentYear.toString());
      if (currentMonth) params.append('month', currentMonth.toString());
      
      const response = await fetch(`/api/proxy/export/leave/excel?${params.toString()}`, {
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
      const filename = `leave-report-${currentYear}${currentMonth ? `-${currentMonth}` : ''}.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export Excel error:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedLeaveIds.length === 0) return;

    try {
      setIsBulkApproving(true);
      
      const response = await fetch('/api/proxy/leave/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ requestIds: selectedLeaveIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to bulk approve' }));
        throw new Error(errorData.error || errorData.message || 'Failed to bulk approve leave requests');
      }

      const data = await response.json();
      
      // Show success message
      setSuccessMessage(`${selectedLeaveIds.length} leave request${selectedLeaveIds.length !== 1 ? 's' : ''} approved successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
      
      // Clear selection and refresh data
      setSelectedLeaveIds([]);
      setShowBulkApproveModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Bulk approve error:', err);
      alert(err.message || 'Failed to bulk approve leave requests');
    } finally {
      setIsBulkApproving(false);
    }
  };

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'rejected').length;

  // Paginate leave requests
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return leaveRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [leaveRequests, currentPage]);

  const totalPages = Math.ceil(leaveRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, leaveRequests.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading leave management...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
        <p className="text-gray-600 mt-1">Manage employee leave requests and balances</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center space-x-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">{rejectedCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{leaveRequests.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Actions - Simplified */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-auto min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="w-full sm:w-auto min-w-[120px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={currentYear}
                onChange={(e) => {
                  setCurrentYear(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto min-w-[160px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={currentMonth || ''}
                onChange={(e) => {
                  const monthValue = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  setCurrentMonth(monthValue);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Months</option>
                {[
                  { value: 1, label: 'January' },
                  { value: 2, label: 'February' },
                  { value: 3, label: 'March' },
                  { value: 4, label: 'April' },
                  { value: 5, label: 'May' },
                  { value: 6, label: 'June' },
                  { value: 7, label: 'July' },
                  { value: 8, label: 'August' },
                  { value: 9, label: 'September' },
                  { value: 10, label: 'October' },
                  { value: 11, label: 'November' },
                  { value: 12, label: 'December' },
                ].map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">View Balance</label>
              <select
                value={selectedEmployee?.id || ''}
                onChange={(e) => e.target.value && handleEmployeeSelect(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setShowRequestForm(true);
              }}
              className="flex items-center justify-center space-x-1.5 bg-primary-600 text-white px-3 py-1 rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap mt-6 sm:mt-0 text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Request Leave</span>
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowBulkApproveModal(true)}
            disabled={selectedLeaveIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Bulk Approve ({selectedLeaveIds.length})</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || leaveRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className={`h-4 w-4 ${isExportingPDF ? 'animate-spin' : ''}`} />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || leaveRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className={`h-4 w-4 ${isExportingExcel ? 'animate-spin' : ''}`} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* Leave Balance Card - Prominently Displayed */}
      {selectedEmployee && selectedEmployeeBalance.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                Leave Balance - {selectedEmployee.name}
              </h3>
              <p className="text-sm text-gray-600">Year {currentYear}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedEmployeeBalance.map((balance) => {
              const isAnnual = balance.leave_type_code?.toUpperCase() === 'ANNUAL';
              const isSick = balance.leave_type_code?.toUpperCase() === 'SICK';
              const bgColor = isAnnual 
                ? 'bg-blue-100 border-blue-300' 
                : isSick 
                ? 'bg-green-100 border-green-300' 
                : 'bg-gray-100 border-gray-300';
              const textColor = isAnnual 
                ? 'text-blue-900' 
                : isSick 
                ? 'text-green-900' 
                : 'text-gray-900';
              const labelColor = isAnnual 
                ? 'text-blue-700' 
                : isSick 
                ? 'text-green-700' 
                : 'text-gray-700';
              
              return (
                <div key={balance.leave_type_id} className={`rounded-lg p-4 border-2 ${bgColor}`}>
                  <p className={`text-sm font-medium mb-1 ${labelColor}`}>
                    {balance.leave_type_name}
                  </p>
                  <p className={`text-3xl font-bold ${textColor} mb-1`}>
                    {balance.remaining_days}
                  </p>
                  <p className={`text-xs ${labelColor}`}>
                    {balance.used_days} of {balance.total_days || '∞'} used
                  </p>
                  {isAnnual && balance.remaining_days !== undefined && balance.total_days && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(balance.used_days / balance.total_days) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>{successMessage}</span>
          </span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Leave Requests Table */}
      <Card title="Leave Requests">
        {leaveRequests.length > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            Showing {startIndex} - {endIndex} of {leaveRequests.length} requests
          </p>
        )}
        <LeaveApprovalTable
          requests={paginatedRequests}
          onUpdate={fetchData}
          selectedLeaveIds={selectedLeaveIds}
          onSelectionChange={setSelectedLeaveIds}
        />
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>

      {/* Leave Request Form Modal */}
      {showRequestForm && (
        <LeaveRequestForm
          isOpen={showRequestForm}
          onClose={() => {
            setShowRequestForm(false);
            setSelectedEmployee(null);
          }}
          employeeId={selectedEmployee?.id}
          employeeName={selectedEmployee?.name}
          employees={employees.map(emp => ({ id: emp.id, name: emp.name }))}
          onSuccess={handleRequestSuccess}
        />
      )}

      {/* Bulk Approve Confirmation Modal */}
      <Modal
        isOpen={showBulkApproveModal}
        onClose={() => setShowBulkApproveModal(false)}
        title="Bulk Approve Leave Requests"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to approve {selectedLeaveIds.length} selected leave request{selectedLeaveIds.length !== 1 ? 's' : ''}?
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowBulkApproveModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkApprove}
              disabled={isBulkApproving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBulkApproving ? 'Approving...' : 'Approve Selected'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

