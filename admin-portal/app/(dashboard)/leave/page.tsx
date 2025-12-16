'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { leaveAPI, employeesAPI, LeaveRequest, LeaveType, LeaveBalance } from '@/lib/api';
import Card from '@/components/Card';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import LeaveApprovalTable from '@/components/LeaveApprovalTable';
import LeaveBalanceCard from '@/components/LeaveBalanceCard';
import { Calendar, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';
import Pagination from '@/components/Pagination';

const ITEMS_PER_PAGE = 10;

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

  // Sync filter status with URL parameter
  useEffect(() => {
    const statusParam = searchParams?.get('status');
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
    setCurrentPage(1); // Reset to first page when filters change
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

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'rejected').length;

  // Paginate leave requests
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return leaveRequests.slice(startIndex, endIndex);
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

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1); // Reset to first page on filter change
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={currentYear}
                onChange={(e) => {
                  setCurrentYear(parseInt(e.target.value, 10));
                  setCurrentPage(1); // Reset to first page on year change
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={currentMonth || ''}
                onChange={(e) => {
                  const monthValue = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  setCurrentMonth(monthValue);
                  setCurrentPage(1); // Reset to first page on month change
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
          <div className="flex flex-col gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View Employee Leave Balance</label>
              <select
                value={selectedEmployee?.id || ''}
                onChange={(e) => e.target.value && handleEmployeeSelect(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[200px]"
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
                // Don't pre-select an employee - let user choose
              }}
              className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Request Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leave Balance Card */}
      {selectedEmployee && selectedEmployeeBalance.length > 0 && (
        <LeaveBalanceCard balances={selectedEmployeeBalance} year={currentYear} />
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
    </div>
  );
}

