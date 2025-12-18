'use client';

import { Timesheet } from '@/lib/api';
import Modal from './Modal';
import { Clock, Calendar, User, Building2, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ViewTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  timesheet: Timesheet | null;
}

export default function ViewTimesheetModal({ isOpen, onClose, timesheet }: ViewTimesheetModalProps) {
  if (!timesheet) return null;

  const toNumber = (value: number | string | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  };

  const regularHours = Math.min(toNumber(timesheet.total_hours), 8);
  const otHours = toNumber(timesheet.overtime_hours);
  const totalHours = toNumber(timesheet.total_hours);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-3 py-1 text-sm font-medium rounded-full';
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
    const baseClasses = 'px-3 py-1 text-sm font-medium rounded-full';
    switch (status) {
      case 'Approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'Rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'Submitted':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'Draft':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getOTStatusBadge = (status?: string) => {
    if (!status) return null;
    const baseClasses = 'px-3 py-1 text-sm font-medium rounded-full';
    switch (status) {
      case 'Approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'Rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'Pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Timesheet Details" size="lg">
      <div className="space-y-6">
        {/* Employee Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-primary-100 rounded-lg">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{timesheet.staff_name}</h3>
              <p className="text-sm text-gray-500">{timesheet.staff_email}</p>
              {timesheet.staff_role && (
                <p className="text-xs text-gray-400 mt-1">{timesheet.staff_role}</p>
              )}
            </div>
          </div>
        </div>

        {/* Date & Time Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Work Date</span>
            </div>
            <p className="text-lg font-semibold text-blue-900">{formatDate(timesheet.work_date)}</p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Time Range</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-purple-700">
                <span className="font-medium">Check In:</span> {formatTime(timesheet.check_in)}
              </p>
              {timesheet.check_out && (
                <p className="text-sm text-purple-700">
                  <span className="font-medium">Check Out:</span> {formatTime(timesheet.check_out)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Hours Breakdown */}
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center space-x-2 mb-4">
            <Clock className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold text-gray-900">Hours Breakdown</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Regular Hours</p>
              <p className="text-2xl font-bold text-blue-600">{regularHours.toFixed(2)}h</p>
            </div>
            {otHours > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Overtime</p>
                <p className="text-2xl font-bold text-orange-600">{otHours.toFixed(2)}h</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-1">Total Hours</p>
              <p className="text-2xl font-bold text-green-600">{totalHours.toFixed(2)}h</p>
            </div>
          </div>
        </div>

        {/* Project Info */}
        {timesheet.project_name && (
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center space-x-2 mb-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-900">Project</span>
            </div>
            <p className="text-lg font-semibold text-indigo-900">{timesheet.project_name}</p>
            {timesheet.task_type && (
              <p className="text-sm text-indigo-700 mt-1">Task: {timesheet.task_type}</p>
            )}
          </div>
        )}

        {/* Status & Approval */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <span className={getStatusBadge(timesheet.status)}>{timesheet.status}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Approval Status</label>
            <span className={getApprovalStatusBadge(timesheet.approval_status)}>
              {timesheet.approval_status}
            </span>
          </div>
        </div>

        {/* OT Approval Status */}
        {otHours > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Approval</label>
            <div className="flex items-center space-x-3">
              {getOTStatusBadge(timesheet.ot_approval_status) ? (
                <span className={getOTStatusBadge(timesheet.ot_approval_status)!}>
                  {timesheet.ot_approval_status}
                </span>
              ) : (
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-800">
                  Not Required
                </span>
              )}
              {timesheet.ot_approved_by_name && (
                <span className="text-sm text-gray-600">
                  by {timesheet.ot_approved_by_name}
                  {timesheet.ot_approved_at && (
                    <> on {formatDate(timesheet.ot_approved_at)}</>
                  )}
                </span>
              )}
            </div>
            {timesheet.ot_justification && (
              <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-medium text-yellow-900 mb-1">OT Justification:</p>
                <p className="text-sm text-yellow-800">{timesheet.ot_justification}</p>
              </div>
            )}
          </div>
        )}

        {/* Approval Info */}
        {timesheet.approval_status === 'Approved' && timesheet.approved_by_name && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Approved by {timesheet.approved_by_name}</p>
                {timesheet.approved_at && (
                  <p className="text-xs text-green-700">on {formatDate(timesheet.approved_at)}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {timesheet.approval_status === 'Rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">Rejected</p>
                {timesheet.remarks && (
                  <p className="text-xs text-red-700 mt-1">{timesheet.remarks}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Remarks */}
        {timesheet.remarks && timesheet.approval_status !== 'Rejected' && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center space-x-2 mb-2">
              <FileText className="h-5 w-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Remarks</span>
            </div>
            <p className="text-sm text-gray-700">{timesheet.remarks}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

