'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, FileText, CheckCircle2, XCircle, AlertCircle, Search, Download, FileSpreadsheet } from 'lucide-react';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import SignaturePad from '@/components/SignaturePad';
import SearchableSelect from '@/components/SearchableSelect';
import { employeesAPI } from '@/lib/api';

interface MonthlySummary {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  month: number;
  year: number;
  total_working_days: number;
  total_worked_hours: number;
  total_ot_hours: number;
  approved_leaves: number;
  absent_days: number;
  status: 'DRAFT' | 'SIGNED_BY_STAFF' | 'APPROVED' | 'REJECTED';
  staff_signed_at?: string;
  admin_approved_at?: string;
  project_breakdown: Array<{
    project_id: string;
    project_name: string;
    days_worked: number;
    total_hours: number;
    ot_hours: number;
  }>;
}

export default function MonthlySummariesPage() {
  const router = useRouter();
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // Show all statuses by default
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [adminSignature, setAdminSignature] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    fetchSummaries();
    fetchEmployees();
  }, [statusFilter, monthFilter, yearFilter, employeeFilter]);

  const fetchEmployees = async () => {
    try {
      const response = await employeesAPI.getAll();
      setEmployees(response.employees || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchSummaries = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (monthFilter) {
        params.append('month', monthFilter);
      }
      if (yearFilter) {
        params.append('year', yearFilter);
      }
      if (employeeFilter !== 'all') {
        params.append('employeeId', employeeFilter);
      }

      const response = await fetch(`/api/proxy/monthly-summaries?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch summaries' }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch monthly summaries');
      }

      const data = await response.json();
      setSummaries(data.summaries || []);
    } catch (err: any) {
      console.error('Error fetching summaries:', err);
      setError(err.message || 'Failed to fetch monthly summaries');
      setSummaries([]);
    } finally {
      setLoading(false);
    }
  };


  const handleQuickApprove = (summaryId: string) => {
    setSelectedSummaryId(summaryId);
    setAdminSignature('');
    setApproveModalOpen(true);
  };

  const handleQuickReject = (summaryId: string) => {
    setSelectedSummaryId(summaryId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleApproveSubmit = async () => {
    if (!adminSignature) {
      setError('Please provide your signature');
      return;
    }

    if (!selectedSummaryId) return;

    try {
      setIsProcessing(true);
      setError('');

      const response = await fetch(`/api/proxy/monthly-summaries/${selectedSummaryId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          signature: adminSignature,
          remarks: null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to approve summary' }));
        throw new Error(errorData.error || errorData.message || 'Failed to approve monthly summary');
      }

      setApproveModalOpen(false);
      setAdminSignature('');
      setSelectedSummaryId(null);
      fetchSummaries();
    } catch (err: any) {
      setError(err.message || 'Failed to approve monthly summary');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    if (!selectedSummaryId) return;

    try {
      setIsProcessing(true);
      setError('');

      const response = await fetch(`/api/proxy/monthly-summaries/${selectedSummaryId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          signature: null, // Rejection doesn't require signature
          remarks: rejectionReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to reject summary' }));
        throw new Error(errorData.error || errorData.message || 'Failed to reject monthly summary');
      }

      setRejectModalOpen(false);
      setRejectionReason('');
      setSelectedSummaryId(null);
      fetchSummaries();
    } catch (err: any) {
      setError(err.message || 'Failed to reject monthly summary');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSummaries = summaries.filter((summary) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        summary.employee_name?.toLowerCase().includes(query) ||
        summary.employee_email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleExportPDF = async () => {
    const approvedSummaries = filteredSummaries.filter(s => s.status === 'APPROVED');
    if (approvedSummaries.length === 0) {
      setError('No approved summaries to export');
      return;
    }

    try {
      setIsExportingPDF(true);
      setError('');
      
      // Export all approved summaries - create a combined PDF or export individually
      // For now, we'll export the first one as an example, but ideally we'd create a combined report
      if (approvedSummaries.length > 0) {
        const response = await fetch(`/api/proxy/export/monthly-summaries/${approvedSummaries[0].id}/pdf`, {
          credentials: 'include',
        });

        if (!response.ok) {
          let errorMessage = 'Failed to export PDF';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // If response is not JSON, try to get text
            const text = await response.text().catch(() => '');
            if (text) errorMessage = text;
          }
          throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const firstSummary = approvedSummaries[0];
        a.download = `monthly-summaries-${monthNames[firstSummary.month - 1]}-${firstSummary.year}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = async () => {
    const approvedSummaries = filteredSummaries.filter(s => s.status === 'APPROVED');
    if (approvedSummaries.length === 0) {
      setError('No approved summaries to export');
      return;
    }

    try {
      setIsExportingExcel(true);
      setError('');
      
      // Export all approved summaries - create a combined Excel or export individually
      // For now, we'll export the first one as an example
      if (approvedSummaries.length > 0) {
        const response = await fetch(`/api/proxy/export/monthly-summaries/${approvedSummaries[0].id}/excel`, {
          credentials: 'include',
        });

        if (!response.ok) {
          let errorMessage = 'Failed to export Excel';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch (e) {
            // If response is not JSON, try to get text
            const text = await response.text().catch(() => '');
            if (text) errorMessage = text;
          }
          throw new Error(errorMessage);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const firstSummary = approvedSummaries[0];
        a.download = `monthly-summaries-${monthNames[firstSummary.month - 1]}-${firstSummary.year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to export Excel');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      SIGNED_BY_STAFF: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Signed by Staff' },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved by Admin' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected by Admin' },
    };
    const badge = badges[status as keyof typeof badges] || badges.DRAFT;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const columns = [
    {
      key: 'employee',
      header: 'Staff',
      render: (item: MonthlySummary) => (
        <div>
          <span className="font-medium text-gray-900">{item.employee_name || item.employee_email}</span>
          {item.employee_email && (
            <p className="text-xs text-gray-500">{item.employee_email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (item: MonthlySummary) => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">
              {monthNames[item.month - 1]} {item.year}
            </span>
          </div>
        );
      },
    },
    {
      key: 'hours',
      header: 'Total Hours',
      render: (item: MonthlySummary) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">
            {(Number(item.total_worked_hours) || 0).toFixed(2)}h
          </span>
        </div>
      ),
    },
    {
      key: 'ot',
      header: 'OT Hours',
      render: (item: MonthlySummary) => (
        <span className="text-sm text-gray-900">
          {(Number(item.total_ot_hours) || 0).toFixed(2)}h
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: MonthlySummary) => getStatusBadge(item.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: MonthlySummary) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/monthly-summaries/${item.id}`)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View Details
          </button>
          {item.status === 'SIGNED_BY_STAFF' && (
            <>
              <button
                onClick={() => handleQuickApprove(item.id)}
                className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => handleQuickReject(item.id)}
                className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (loading && summaries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading monthly summaries...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Monthly Summary Approvals</h1>
          <p className="text-gray-600 mt-1">Review and approve staff-signed monthly summaries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || filteredSummaries.filter(s => s.status === 'APPROVED').length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className={`h-4 w-4 ${isExportingPDF ? 'animate-spin' : ''}`} />
            <span>Export PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || filteredSummaries.filter(s => s.status === 'APPROVED').length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className={`h-4 w-4 ${isExportingExcel ? 'animate-spin' : ''}`} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search by staff name or email..."
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SIGNED_BY_STAFF">Pending (Signed by Staff)</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[150px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return (
                  <option key={month} value={month}>
                    {monthNames[month - 1]}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[120px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              min="2020"
              max="2100"
            />
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px]">
            <SearchableSelect
              options={[
                { value: 'all', label: 'All Employees' },
                ...employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.name} ${emp.email ? `(${emp.email})` : ''}`,
                })),
              ]}
              value={employeeFilter}
              onChange={(value) => setEmployeeFilter(value)}
              placeholder="Filter by employee"
            />
          </div>
        </div>
      </div>

      {/* Summaries Table */}
      {filteredSummaries.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No monthly summaries found</p>
          <p className="text-sm text-gray-400 mt-2">
            Generate a summary to get started
          </p>
        </div>
      ) : (
        <Table
          columns={columns}
          data={filteredSummaries}
          keyExtractor={(item) => item.id}
          emptyMessage="No monthly summaries found"
        />
      )}

      {/* Approve Modal */}
      <Modal
        isOpen={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setAdminSignature('');
          setSelectedSummaryId(null);
          setError('');
        }}
        title="Approve Monthly Summary"
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
            Please provide your e-signature to approve this monthly summary. Once approved, the summary will be locked and used for payroll.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin E-Signature *
            </label>
            {adminSignature && (
              <div className="mb-3 p-2 bg-gray-50 rounded border">
                <img src={adminSignature} alt="Admin signature" className="h-20 object-contain" />
              </div>
            )}
            <SignaturePad
              onSave={(signature) => setAdminSignature(signature)}
              onClear={() => setAdminSignature('')}
              disabled={isProcessing}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setApproveModalOpen(false);
                setAdminSignature('');
                setSelectedSummaryId(null);
                setError('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveSubmit}
              disabled={!adminSignature || isProcessing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Approving...' : 'Approve'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectionReason('');
          setSelectedSummaryId(null);
          setError('');
        }}
        title="Reject Monthly Summary"
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded text-sm">
            Please provide a reason for rejection. The staff member will be notified and can re-sign after corrections.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter the reason for rejection..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setRejectModalOpen(false);
                setRejectionReason('');
                setSelectedSummaryId(null);
                setError('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectSubmit}
              disabled={!rejectionReason.trim() || isProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Rejecting...' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

