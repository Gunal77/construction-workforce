'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, FileText, CheckCircle2, XCircle, User, Building2, Download, FileSpreadsheet } from 'lucide-react';
import SignaturePad from '@/components/SignaturePad';
import Input from '@/components/Input';

interface MonthlySummary {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_role?: string;
  month: number;
  year: number;
  total_working_days: number;
  total_worked_hours: number;
  total_ot_hours: number;
  approved_leaves: number;
  absent_days: number;
  status: 'DRAFT' | 'SIGNED_BY_STAFF' | 'APPROVED' | 'REJECTED';
  staff_signature?: string;
  staff_signed_at?: string;
  staff_user_email?: string;
  admin_signature?: string;
  admin_approved_at?: string;
  admin_name?: string;
  admin_email?: string;
  admin_remarks?: string;
  project_breakdown: Array<{
    project_id: string;
    project_name: string;
    days_worked: number;
    total_hours: number;
    ot_hours: number;
  }>;
  created_at: string;
  updated_at: string;
}

export default function MonthlySummaryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminSignature, setAdminSignature] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchSummary();
    }
  }, [params.id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/proxy/monthly-summaries/${params.id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch summary' }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch monthly summary');
      }

      const data = await response.json();
      setSummary(data.summary);
      setRemarks(data.summary.admin_remarks || '');
    } catch (err: any) {
      console.error('Error fetching summary:', err);
      setError(err.message || 'Failed to fetch monthly summary');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!adminSignature) {
      setError('Please provide your signature');
      return;
    }

    try {
      setIsApproving(true);
      setError('');

      const response = await fetch(`/api/proxy/monthly-summaries/${params.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'approve',
          signature: adminSignature,
          remarks: remarks || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to approve summary' }));
        throw new Error(errorData.error || errorData.message || 'Failed to approve monthly summary');
      }

      router.push('/monthly-summaries');
    } catch (err: any) {
      setError(err.message || 'Failed to approve monthly summary');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!adminSignature) {
      setError('Please provide your signature');
      return;
    }

    if (!remarks) {
      setError('Please provide rejection remarks');
      return;
    }

    try {
      setIsApproving(true);
      setError('');

      const response = await fetch(`/api/proxy/monthly-summaries/${params.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          signature: adminSignature,
          remarks: remarks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to reject summary' }));
        throw new Error(errorData.error || errorData.message || 'Failed to reject monthly summary');
      }

      router.push('/monthly-summaries');
    } catch (err: any) {
      setError(err.message || 'Failed to reject monthly summary');
    } finally {
      setIsApproving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!summary || summary.status !== 'APPROVED') return;
    
    try {
      setIsExportingPDF(true);
      setError('');
      
      const response = await fetch(`/api/proxy/export/monthly-summaries/${summary.id}/pdf`, {
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
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      a.download = `monthly-summary-${summary.employee_name}-${monthNames[summary.month - 1]}-${summary.year}.pdf`;
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
    if (!summary || summary.status !== 'APPROVED') return;
    
    try {
      setIsExportingExcel(true);
      setError('');
      
      const response = await fetch(`/api/proxy/export/monthly-summaries/${summary.id}/excel`, {
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
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      a.download = `monthly-summary-${summary.employee_name}-${monthNames[summary.month - 1]}-${summary.year}.xlsx`;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading monthly summary...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Monthly summary not found</div>
      </div>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const isReadOnly = summary.status === 'APPROVED';
  const canApprove = summary.status === 'SIGNED_BY_STAFF';

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Monthly Summaries
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Monthly Summary</h1>
            <p className="text-gray-600 mt-1">
              {monthNames[summary.month - 1]} {summary.year}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {summary.status === 'APPROVED' && (
              <>
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className={`h-4 w-4 ${isExportingPDF ? 'animate-spin' : ''}`} />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={isExportingExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FileSpreadsheet className={`h-4 w-4 ${isExportingExcel ? 'animate-spin' : ''}`} />
                  <span>Export Excel</span>
                </button>
              </>
            )}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              summary.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
              summary.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
              summary.status === 'SIGNED_BY_STAFF' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {summary.status === 'APPROVED' ? 'Approved by Admin' :
               summary.status === 'REJECTED' ? 'Rejected by Admin' :
               summary.status === 'SIGNED_BY_STAFF' ? 'Signed by Staff' :
               'Draft'}
            </div>
          </div>
        </div>

        {/* Employee Info */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-lg">
              <User className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{summary.employee_name}</h3>
              <p className="text-sm text-gray-600">{summary.employee_email}</p>
              {summary.employee_role && (
                <p className="text-xs text-gray-500">{summary.employee_role}</p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">Working Days</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.total_working_days}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">Total Hours</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{(Number(summary.total_worked_hours) || 0).toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-gray-600">OT Hours</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{(Number(summary.total_ot_hours) || 0).toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-green-600" />
              <span className="text-sm text-gray-600">Approved Leaves</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{(Number(summary.approved_leaves) || 0).toFixed(2)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm text-gray-600">Absent Days</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.absent_days}</p>
          </div>
        </div>

        {/* Project Breakdown */}
        {summary.project_breakdown && summary.project_breakdown.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Days Worked</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">OT Hours</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summary.project_breakdown.map((project, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{project.project_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{project.days_worked}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{(Number(project.total_hours) || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{(Number(project.ot_hours) || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staff Signature */}
        {summary.staff_signature && (
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Staff Signature</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <img 
                src={summary.staff_signature} 
                alt="Staff signature" 
                className="max-w-md h-32 object-contain bg-white border border-gray-200 rounded"
              />
              <p className="text-sm text-gray-600 mt-2">
                Signed by: {summary.staff_user_email || 'Staff'} on{' '}
                {summary.staff_signed_at ? new Date(summary.staff_signed_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Admin Approval Section */}
        {canApprove && !isReadOnly && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Admin Approval</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Add any remarks or notes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-Signature *
              </label>
              <SignaturePad
                onSave={(signature) => setAdminSignature(signature)}
                onClear={() => setAdminSignature('')}
                disabled={isApproving}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleReject}
                disabled={isApproving || !adminSignature}
                className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-5 w-5" />
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={isApproving || !adminSignature}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-5 w-5" />
                Approve
              </button>
            </div>
          </div>
        )}

        {/* Admin Signature (if approved/rejected) */}
        {summary.admin_signature && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Admin Signature</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <img 
                src={summary.admin_signature} 
                alt="Admin signature" 
                className="max-w-md h-32 object-contain bg-white border border-gray-200 rounded"
              />
              <p className="text-sm text-gray-600 mt-2">
                {summary.status === 'APPROVED' ? 'Approved' : 'Rejected'} by: {summary.admin_name || summary.admin_email || 'Admin'} on{' '}
                {summary.admin_approved_at ? new Date(summary.admin_approved_at).toLocaleString() : 'N/A'}
              </p>
              {summary.admin_remarks && (
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Remarks:</strong> {summary.admin_remarks}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Read-only notice */}
        {isReadOnly && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              This summary has been approved and is now read-only. No further changes can be made.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

