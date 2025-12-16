'use client';

interface LastEndDateBadgeProps {
  lastEndDate: string | null | undefined;
  className?: string;
}

export default function LastEndDateBadge({ lastEndDate, className = '' }: LastEndDateBadgeProps) {
  if (!lastEndDate) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 ${className}`}>
        Never
      </span>
    );
  }

  const date = new Date(lastEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const endDate = new Date(date);
  endDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - endDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let bgColor = 'bg-red-100';
  let textColor = 'text-red-800';
  let label = 'Old';
  
  if (diffDays === 0) {
    bgColor = 'bg-green-100';
    textColor = 'text-green-800';
    label = 'Today';
  } else if (diffDays === 1) {
    bgColor = 'bg-yellow-100';
    textColor = 'text-yellow-800';
    label = 'Yesterday';
  } else if (diffDays > 1) {
    bgColor = 'bg-red-100';
    textColor = 'text-red-800';
    label = `${diffDays} days ago`;
  }
  
  const formattedDate = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  
  const formattedTime = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <span 
      className={`px-2 py-1 text-xs font-medium rounded-full ${bgColor} ${textColor} ${className}`}
      title={`${formattedDate} at ${formattedTime}`}
    >
      {label}
    </span>
  );
}

