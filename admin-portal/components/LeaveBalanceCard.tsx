'use client';

import { LeaveBalance } from '@/lib/api';
import { Calendar } from 'lucide-react';

interface LeaveBalanceCardProps {
  balances: LeaveBalance[];
  year?: number;
}

export default function LeaveBalanceCard({ balances, year }: LeaveBalanceCardProps) {
  const currentYear = year || new Date().getFullYear();
  const annualLeave = balances.find(b => b.leave_type_code === 'ANNUAL');
  const sickLeave = balances.find(b => b.leave_type_code === 'SICK');
  const unpaidLeave = balances.find(b => b.leave_type_code === 'UNPAID');

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Calendar className="h-5 w-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-800">Leave Balance ({currentYear})</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {annualLeave && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-600 font-medium mb-1">Annual Leave</p>
            <p className="text-2xl font-bold text-blue-900">{annualLeave.remaining_days}</p>
            <p className="text-xs text-blue-600 mt-1">
              {annualLeave.used_days} of {annualLeave.total_days} used
            </p>
          </div>
        )}
        
        {sickLeave && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-sm text-green-600 font-medium mb-1">Sick Leave</p>
            <p className="text-2xl font-bold text-green-900">{sickLeave.remaining_days}</p>
            <p className="text-xs text-green-600 mt-1">
              {sickLeave.used_days} of {sickLeave.total_days || '∞'} used
            </p>
          </div>
        )}
        
        {unpaidLeave && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 font-medium mb-1">Unpaid Leave</p>
            <p className="text-2xl font-bold text-gray-900">{unpaidLeave.remaining_days}</p>
            <p className="text-xs text-gray-600 mt-1">
              {unpaidLeave.used_days} used
            </p>
          </div>
        )}
      </div>
      
      {balances.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No leave balance data available</p>
      )}
    </div>
  );
}

