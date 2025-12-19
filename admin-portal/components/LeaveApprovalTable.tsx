'use client';

import { useState, useMemo } from 'react';
import { LeaveRequest, leaveAPI } from '@/lib/api';
import Table from './Table';
import Modal from './Modal';
import Pagination from './Pagination';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface LeaveApprovalTableProps {
  requests: LeaveRequest[];
  onUpdate: () => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  selectedLeaveIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export default function LeaveApprovalTable({ 
  requests, 
  onUpdate,
  currentPage: externalCurrentPage,
  onPageChange: externalOnPageChange,
  itemsPerPage = 10,
  selectedLeaveIds = [],
  onSelectionChange,
}: LeaveApprovalTableProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectionModal, setRejectionModal] = useState<{ open: boolean; requestId: string | null; request?: LeaveRequest }>({
    open: false,
    requestId: null,
  });
  const [approvalModal, setApprovalModal] = useState<{ open: boolean; requestId: string | null; request?: LeaveRequest }>({
    open: false,
    requestId: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [internalPage, setInternalPage] = useState(1);
  
  const currentPage = externalCurrentPage ?? internalPage;
  const onPageChange = externalOnPageChange ?? setInternalPage;

  // If external pagination is provided, use requests directly (already paginated)
  // Otherwise, paginate internally
  const paginatedRequests = useMemo(() => {
    if (externalCurrentPage !== undefined || externalOnPageChange) {
      // External pagination - use requests as-is (already paginated by parent)
      return requests;
    }
    // Internal pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    return requests.slice(startIndex, startIndex + itemsPerPage);
  }, [requests, currentPage, itemsPerPage, externalCurrentPage, externalOnPageChange]);

  const totalPages = externalCurrentPage !== undefined || externalOnPageChange 
    ? 0 // Don't show pagination if external pagination is used
    : Math.ceil(requests.length / itemsPerPage);

  const handleApprove = async () => {
    if (!approvalModal.requestId) return;
    
    setLoading(approvalModal.requestId);
    try {
      await leaveAPI.updateRequestStatus(approvalModal.requestId, 'approved');
      setApprovalModal({ open: false, requestId: null });
      setSuccessMessage('Leave request approved successfully!');
      onUpdate();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error approving request:', err);
      alert(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionModal.requestId) return;
    
    setLoading(rejectionModal.requestId);
    try {
      await leaveAPI.updateRequestStatus(
        rejectionModal.requestId,
        'rejected',
        rejectionReason
      );
      setRejectionModal({ open: false, requestId: null });
      setRejectionReason('');
      setSuccessMessage('Leave request rejected successfully!');
      onUpdate();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      alert(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'cancelled':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (requestId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      onSelectionChange([...selectedLeaveIds, requestId]);
    } else {
      onSelectionChange(selectedLeaveIds.filter(id => id !== requestId));
    }
  };

  // Handle "Select All" checkbox
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    
    if (checked) {
      // Only select PENDING requests
      const pendingIds = paginatedRequests
        .filter(req => req.status === 'pending')
        .map(req => req.id);
      onSelectionChange([...new Set([...selectedLeaveIds, ...pendingIds])]);
    } else {
      // Deselect all visible requests
      const visibleIds = paginatedRequests.map(req => req.id);
      onSelectionChange(selectedLeaveIds.filter(id => !visibleIds.includes(id)));
    }
  };

  // Check if all visible pending requests are selected
  const pendingRequests = paginatedRequests.filter(req => req.status === 'pending');
  const allPendingSelected = pendingRequests.length > 0 && 
    pendingRequests.every(req => selectedLeaveIds.includes(req.id));
  const somePendingSelected = pendingRequests.some(req => selectedLeaveIds.includes(req.id));

  const columns = [
    {
      key: 'checkbox',
      header: 'Select',
      renderHeader: () => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={allPendingSelected}
            ref={(input) => {
              if (input) input.indeterminate = somePendingSelected && !allPendingSelected;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded cursor-pointer"
          />
        </div>
      ),
      render: (item: LeaveRequest) => {
        const isPending = item.status === 'pending';
        const isChecked = selectedLeaveIds.includes(item.id);
        
        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              checked={isChecked}
              disabled={!isPending}
              onChange={(e) => {
                e.stopPropagation();
                handleCheckboxChange(item.id, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ${
                isPending ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            />
          </div>
        );
      },
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (item: LeaveRequest) => (
        <div>
          <span className="font-medium text-gray-900">{item.employee_name}</span>
          <p className="text-xs text-gray-500">{item.employee_email}</p>
        </div>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (item: LeaveRequest) => (
        <div>
          <span className="text-sm text-gray-900">{item.project_name || 'Not assigned'}</span>
        </div>
      ),
    },
    {
      key: 'leave_type',
      header: 'Leave Type',
      render: (item: LeaveRequest) => {
        const typeColors: Record<string, string> = {
          'ANNUAL': 'bg-blue-100 text-blue-800',
          'SICK': 'bg-green-100 text-green-800',
          'UNPAID': 'bg-gray-100 text-gray-800',
        };
        const colorClass = typeColors[item.leave_type_code?.toUpperCase() || ''] || 'bg-gray-100 text-gray-800';
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
            {item.leave_type_name}
          </span>
        );
      },
    },
    {
      key: 'dates',
      header: 'Date Range',
      render: (item: LeaveRequest) => {
        const start = new Date(item.start_date).toLocaleDateString('en-GB');
        const end = new Date(item.end_date).toLocaleDateString('en-GB');
        return (
          <div>
            <p className="text-sm text-gray-900">{start} - {end}</p>
            <p className="text-xs text-gray-500">{item.number_of_days} day{item.number_of_days !== 1 ? 's' : ''}</p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: LeaveRequest) => (
        <span className={getStatusBadge(item.status)}>
          {item.status.toUpperCase()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: LeaveRequest) => (
        <div className="flex items-center space-x-2">
          {item.status === 'pending' && (
            <>
              <button
                onClick={() => setApprovalModal({ open: true, requestId: item.id, request: item })}
                disabled={loading === item.id}
                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => setRejectionModal({ open: true, requestId: item.id, request: item })}
                disabled={loading === item.id}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Reject"
              >
                <XCircle className="h-4 w-4" />
                <span>Reject</span>
              </button>
            </>
          )}
          {item.status === 'approved' && item.approved_by_name && (
            <div className="text-xs text-gray-500">
              <p>Approved by {item.approved_by_name}</p>
              {item.approved_at && (
                <p className="text-gray-400">
                  {new Date(item.approved_at).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          )}
          {item.status === 'rejected' && (
            <div className="text-xs text-gray-500">
              <p>Rejected</p>
              {item.rejection_reason && (
                <p className="text-gray-400" title={item.rejection_reason}>
                  {item.rejection_reason.length > 30 
                    ? item.rejection_reason.substring(0, 30) + '...' 
                    : item.rejection_reason}
                </p>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
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

      {/* Results count - only show if using internal pagination */}
      {requests.length > 0 && (externalCurrentPage === undefined && !externalOnPageChange) && (
        <div className="text-sm text-gray-600 mb-4">
          Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, requests.length)} of {requests.length} requests
        </div>
      )}

      <Table
        columns={columns}
        data={paginatedRequests}
        keyExtractor={(item) => item.id}
        emptyMessage="No leave requests found"
      />

      {/* Pagination - only show if using internal pagination */}
      {totalPages > 1 && (externalCurrentPage === undefined && !externalOnPageChange) && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}

      {/* Approval Confirmation Modal */}
      <Modal
        isOpen={approvalModal.open}
        onClose={() => {
          setApprovalModal({ open: false, requestId: null });
        }}
        title="Approve Leave Request"
      >
        <div className="space-y-4">
          {approvalModal.request && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Employee:</span>
                <span className="text-sm text-gray-900">{approvalModal.request.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Project:</span>
                <span className="text-sm text-gray-900">{approvalModal.request.project_name || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Leave Type:</span>
                <span className="text-sm text-gray-900">{approvalModal.request.leave_type_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Date Range:</span>
                <span className="text-sm text-gray-900">
                  {new Date(approvalModal.request.start_date).toLocaleDateString('en-GB')} - {new Date(approvalModal.request.end_date).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Days:</span>
                <span className="text-sm text-gray-900">{approvalModal.request.number_of_days} day{approvalModal.request.number_of_days !== 1 ? 's' : ''}</span>
              </div>
              {approvalModal.request.reason && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Reason:</span>
                  <p className="text-sm text-gray-900 mt-1">{approvalModal.request.reason}</p>
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-gray-600">
            Are you sure you want to approve this leave request?
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setApprovalModal({ open: false, requestId: null });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={loading !== null}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Approving...' : 'Approve Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={rejectionModal.open}
        onClose={() => {
          setRejectionModal({ open: false, requestId: null });
          setRejectionReason('');
        }}
        title="Reject Leave Request"
      >
        <div className="space-y-4">
          {rejectionModal.request && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Employee:</span>
                <span className="text-sm text-gray-900">{rejectionModal.request.employee_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Project:</span>
                <span className="text-sm text-gray-900">{rejectionModal.request.project_name || 'Not assigned'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Leave Type:</span>
                <span className="text-sm text-gray-900">{rejectionModal.request.leave_type_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Date Range:</span>
                <span className="text-sm text-gray-900">
                  {new Date(rejectionModal.request.start_date).toLocaleDateString('en-GB')} - {new Date(rejectionModal.request.end_date).toLocaleDateString('en-GB')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-700">Days:</span>
                <span className="text-sm text-gray-900">{rejectionModal.request.number_of_days} day{rejectionModal.request.number_of_days !== 1 ? 's' : ''}</span>
              </div>
              {rejectionModal.request.reason && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">Reason:</span>
                  <p className="text-sm text-gray-900 mt-1">{rejectionModal.request.reason}</p>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason *
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter reason for rejection..."
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setRejectionModal({ open: false, requestId: null });
                setRejectionReason('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || loading !== null}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

