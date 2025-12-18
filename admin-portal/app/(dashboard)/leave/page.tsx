'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { leaveAPI, employeesAPI, LeaveRequest, LeaveType, LeaveBalance } from '@/lib/api';
import Card from '@/components/Card';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import LeaveBalanceCard from '@/components/LeaveBalanceCard';
import { Calendar, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';

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

  const pendingCount = leaveRequests.filter(r => r.status === 'pending').length;
  const approvedCount = leaveRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = leaveRequests.filter(r => r.status === 'rejected').length;

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

