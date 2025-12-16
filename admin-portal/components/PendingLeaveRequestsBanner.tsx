'use client';

import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';

interface PendingLeaveRequestsBannerProps {
  count: number;
}

export default function PendingLeaveRequestsBanner({ count }: PendingLeaveRequestsBannerProps) {
  const router = useRouter();

  if (count === 0) {
    return null;
  }

  const handleClick = () => {
    // Navigate to leave management page with pending filter
    router.push('/leave?status=pending');
  };

  return (
    <button
      onClick={handleClick}
      className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-center space-x-3">
        <Calendar className="h-5 w-5 text-yellow-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-800">
            {count} Pending Leave Request{count !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-yellow-600 mt-0.5">
            Click to review and approve leave requests
          </p>
        </div>
        <div className="text-yellow-600">
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </button>
  );
}

