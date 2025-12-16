'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface CompareDateRange {
  enabled: boolean;
  type: 'previous-year' | 'previous-month' | 'custom';
  from: Date | null;
  to: Date | null;
}

interface DateRangeFilterProps {
  onDateRangeChange: (range: DateRange, compareRange?: CompareDateRange) => void;
}

type DateRangePreset = 'custom' | 'today' | 'week-till-date' | 'month-till-date' | 'year-till-date' | 'last-time-period';

export default function DateRangeFilter({ onDateRangeChange }: DateRangeFilterProps) {
  const [preset, setPreset] = useState<DateRangePreset>('month-till-date');
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareType, setCompareType] = useState<'previous-year' | 'previous-month' | 'custom'>('previous-year');
  const [compareFromDate, setCompareFromDate] = useState<Date | null>(null);
  const [compareToDate, setCompareToDate] = useState<Date | null>(null);
  
  // Calendar view state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentMonth2, setCurrentMonth2] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });
  const [compareCurrentMonth, setCompareCurrentMonth] = useState(new Date());
  const [compareCurrentMonth2, setCompareCurrentMonth2] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCompareCalendar, setShowCompareCalendar] = useState(false);
  const [selectingFrom, setSelectingFrom] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize with current month - don't call onDateRangeChange here
  // Let the parent component handle initial load
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFromDate(firstDayOfMonth);
    setToDate(lastDayOfMonth);
  }, []);

  // Apply preset - only update dates, don't call onDateRangeChange
  useEffect(() => {
    if (preset === 'custom') {
      return; // Keep existing dates for custom
    }

    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    switch (preset) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week-till-date':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
        from = new Date(now.getFullYear(), now.getMonth(), diff);
        to = now;
        break;
      case 'month-till-date':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = now;
        break;
      case 'year-till-date':
        from = new Date(now.getFullYear(), 0, 1);
        to = now;
        break;
      case 'last-time-period':
        // Last 30 days
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        to = now;
        break;
    }

    if (from && to) {
      setFromDate(from);
      setToDate(to);
      setHasChanges(true);
    }
  }, [preset]);

  // Calculate compare dates - only update dates, don't call onDateRangeChange
  useEffect(() => {
    if (!compareEnabled || !fromDate || !toDate) {
      if (!compareEnabled) {
        setCompareFromDate(null);
        setCompareToDate(null);
      }
      return;
    }

    if (compareType === 'custom') {
      // Use compareFromDate and compareToDate - don't auto-calculate
      return;
    }

    let compareFrom: Date | null = null;
    let compareTo: Date | null = null;

    switch (compareType) {
      case 'previous-year':
        compareFrom = new Date(fromDate.getFullYear() - 1, fromDate.getMonth(), fromDate.getDate());
        compareTo = new Date(toDate.getFullYear() - 1, toDate.getMonth(), toDate.getDate());
        break;
      case 'previous-month':
        compareFrom = new Date(fromDate.getFullYear(), fromDate.getMonth() - 1, fromDate.getDate());
        compareTo = new Date(toDate.getFullYear(), toDate.getMonth() - 1, toDate.getDate());
        break;
    }

    if (compareFrom && compareTo) {
      setCompareFromDate(compareFrom);
      setCompareToDate(compareTo);
      setHasChanges(true);
    }
  }, [compareEnabled, compareType, fromDate, toDate]);

  const handleApply = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const finalFromDate = fromDate || (() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    })();
    const finalToDate = toDate || new Date();
    
    const actualFrom = finalFromDate <= finalToDate ? finalFromDate : finalToDate;
    const actualTo = finalToDate >= finalFromDate ? finalToDate : finalFromDate;
    
    const range: DateRange = { from: actualFrom, to: actualTo };
    const compareRange: CompareDateRange | undefined = compareEnabled && compareFromDate && compareToDate
      ? {
          enabled: true,
          type: compareType,
          from: compareFromDate,
          to: compareToDate,
        }
      : undefined;
    
    // Use setTimeout to prevent page reload and allow smooth transition
    setTimeout(() => {
      onDateRangeChange(range, compareRange);
    }, 0);
    
    setHasChanges(false);
    setShowCalendar(false);
    setShowCompareCalendar(false);
  };

  const handleCancel = () => {
    // Reset to initial values
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setFromDate(firstDayOfMonth);
    setToDate(lastDayOfMonth);
    setPreset('month-till-date');
    setCompareEnabled(false);
    setHasChanges(false);
    setShowCalendar(false);
    setShowCompareCalendar(false);
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateInput = (date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateInputChange = (type: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : null;
    if (type === 'from') {
      setFromDate(date);
      setPreset('custom');
    } else {
      setToDate(date);
      setPreset('custom');
    }
    setHasChanges(true);
  };

  const handleCompareDateInputChange = (type: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : null;
    if (type === 'from') {
      setCompareFromDate(date);
      setCompareType('custom');
    } else {
      setCompareToDate(date);
      setCompareType('custom');
    }
    setHasChanges(true);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateInRange = (date: Date, from: Date | null, to: Date | null) => {
    if (!from || !to) return false;
    const dateTime = date.getTime();
    const fromTime = from.getTime();
    const toTime = to.getTime();
    return dateTime >= fromTime && dateTime <= toTime;
  };

      const isDateSelected = (date: Date, from: Date | null, to: Date | null) => {
        if (!from || !to) return false;
        const dateTime = date.getTime();
        return dateTime === from.getTime() || dateTime === to.getTime();
      };

      const isEndDate = (date: Date, from: Date | null, to: Date | null) => {
        if (!to) return false;
        return date.getTime() === to.getTime();
      };

  const handleDateClick = (date: Date) => {
    if (showCalendar) {
      if (selectingFrom || !fromDate || date < fromDate) {
        setFromDate(date);
        setSelectingFrom(false);
        if (!toDate || date > toDate) {
          setToDate(date);
        }
      } else {
        setToDate(date);
        setSelectingFrom(true);
      }
      setPreset('custom');
      setHasChanges(true);
    } else if (showCompareCalendar) {
      if (selectingFrom || !compareFromDate || date < compareFromDate) {
        setCompareFromDate(date);
        setSelectingFrom(false);
        if (!compareToDate || date > compareToDate) {
          setCompareToDate(date);
        }
      } else {
        setCompareToDate(date);
        setSelectingFrom(true);
      }
      setCompareType('custom');
      setHasChanges(true);
    }
  };

  const renderCalendar = (month: Date, from: Date | null, to: Date | null, isCompare: boolean = false) => {
    const daysInMonth = getDaysInMonth(month);
    const firstDay = getFirstDayOfMonth(month);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8 sm:w-10 sm:h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const isInRange = isDateInRange(date, from, to);
      const isSelected = isDateSelected(date, from, to);
      const isEnd = isEndDate(date, from, to);
      const isToday = date.toDateString() === new Date().toDateString();

      days.push(
        <button
          key={day}
          onClick={() => handleDateClick(date)}
          className={`
            w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-colors relative
            ${isEnd
              ? isCompare
                ? 'bg-orange-600 text-white ring-4 ring-orange-400 font-bold shadow-lg'
                : 'bg-primary-600 text-white ring-4 ring-primary-400 font-bold shadow-lg'
              : isSelected
              ? isCompare
                ? 'bg-orange-600 text-white ring-2 ring-orange-300'
                : 'bg-blue-600 text-white ring-2 ring-blue-300'
              : isInRange
              ? isCompare
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'hover:bg-gray-100 text-gray-700'}
            ${isToday && !isEnd ? 'ring-2 ring-primary-400' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  const navigateMonth = (direction: 'prev' | 'next', isCompare: boolean = false, calendarIndex: number = 0) => {
    if (isCompare) {
      if (calendarIndex === 0) {
        const newMonth = new Date(compareCurrentMonth);
        newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
        setCompareCurrentMonth(newMonth);
      } else {
        const newMonth = new Date(compareCurrentMonth2);
        newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
        setCompareCurrentMonth2(newMonth);
      }
    } else {
      if (calendarIndex === 0) {
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentMonth(newMonth);
      } else {
        const newMonth = new Date(currentMonth2);
        newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentMonth2(newMonth);
      }
    }
  };

  const navigateYear = (direction: 'prev' | 'next', isCompare: boolean = false, calendarIndex: number = 0) => {
    if (isCompare) {
      if (calendarIndex === 0) {
        const newMonth = new Date(compareCurrentMonth);
        newMonth.setFullYear(newMonth.getFullYear() + (direction === 'next' ? 1 : -1));
        setCompareCurrentMonth(newMonth);
      } else {
        const newMonth = new Date(compareCurrentMonth2);
        newMonth.setFullYear(newMonth.getFullYear() + (direction === 'next' ? 1 : -1));
        setCompareCurrentMonth2(newMonth);
      }
    } else {
      if (calendarIndex === 0) {
        const newMonth = new Date(currentMonth);
        newMonth.setFullYear(newMonth.getFullYear() + (direction === 'next' ? 1 : -1));
        setCurrentMonth(newMonth);
      } else {
        const newMonth = new Date(currentMonth2);
        newMonth.setFullYear(newMonth.getFullYear() + (direction === 'next' ? 1 : -1));
        setCurrentMonth2(newMonth);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 md:p-6 w-full max-w-full overflow-x-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 min-w-0">
        {/* Main Date Range Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date Range
            </label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as DateRangePreset);
                setHasChanges(true);
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="custom">Custom</option>
              <option value="today">Today</option>
              <option value="week-till-date">Week till date</option>
              <option value="month-till-date">Month till date</option>
              <option value="year-till-date">Year till date</option>
              <option value="last-time-period">Last time period</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Calendar</label>
            <input
              type="text"
              value="Gregorian"
              readOnly
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
              <div className="relative">
                <input
                  type="date"
                  value={formatDateInput(fromDate)}
                  onChange={(e) => handleDateInputChange('from', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCalendar(!showCalendar);
                    setShowCompareCalendar(false);
                    setSelectingFrom(true);
                    if (!showCalendar && fromDate) {
                      setCurrentMonth(new Date(fromDate));
                      const nextMonth = new Date(fromDate);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setCurrentMonth2(nextMonth);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <Calendar className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <span className="text-primary-600 font-semibold">To</span>
                <span className="ml-1 text-xs text-primary-500">(End Date)</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formatDateInput(toDate)}
                  onChange={(e) => handleDateInputChange('to', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-primary-500 bg-primary-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-600 font-medium text-primary-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCalendar(!showCalendar);
                    setShowCompareCalendar(false);
                    setSelectingFrom(false);
                    if (!showCalendar && toDate) {
                      setCurrentMonth(new Date(toDate));
                      const nextMonth = new Date(toDate);
                      nextMonth.setMonth(nextMonth.getMonth() + 1);
                      setCurrentMonth2(nextMonth);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-600 hover:text-primary-700"
                >
                  <Calendar className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar View */}
          {showCalendar && (
            <div className="border border-gray-200 rounded-lg p-2 md:p-4 bg-white shadow-lg z-50 mt-4 relative w-full max-w-full overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
                {/* First Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => navigateYear('prev', false, 0)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Previous year"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <ChevronLeft className="h-4 w-4 -ml-2" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateMonth('prev', false, 0)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Previous month"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="w-20" />
                  </div>
                  {renderCalendar(currentMonth, fromDate, toDate)}
                </div>
                {/* Second Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-20" />
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {currentMonth2.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => navigateMonth('next', false, 1)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Next month"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => navigateYear('next', false, 1)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Next year"
                      >
                        <ChevronRight className="h-4 w-4" />
                        <ChevronRight className="h-4 w-4 -ml-2" />
                      </button>
                    </div>
                  </div>
                  {renderCalendar(currentMonth2, fromDate, toDate)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compare Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="compare"
              checked={compareEnabled}
              onChange={(e) => {
                setCompareEnabled(e.target.checked);
                setHasChanges(true);
              }}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="compare" className="text-sm font-medium text-gray-700">
              Compare to
            </label>
          </div>

          {compareEnabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Compare Type</label>
                <select
                  value={compareType}
                  onChange={(e) => {
                    setCompareType(e.target.value as any);
                    setHasChanges(true);
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="previous-year">Previous year same dates</option>
                  <option value="previous-month">Previous months same dates</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {compareType === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formatDateInput(compareFromDate)}
                        onChange={(e) => handleCompareDateInputChange('from', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCompareCalendar(!showCompareCalendar);
                          setShowCalendar(false);
                          setSelectingFrom(true);
                          if (!showCompareCalendar && compareFromDate) {
                            setCompareCurrentMonth(new Date(compareFromDate));
                            const nextMonth = new Date(compareFromDate);
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            setCompareCurrentMonth2(nextMonth);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-orange-600 font-semibold">To</span>
                      <span className="ml-1 text-xs text-orange-500">(End Date)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formatDateInput(compareToDate)}
                        onChange={(e) => handleCompareDateInputChange('to', e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-orange-500 bg-orange-50 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-600 font-medium text-orange-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCompareCalendar(!showCompareCalendar);
                          setShowCalendar(false);
                          setSelectingFrom(false);
                          if (!showCompareCalendar && compareToDate) {
                            setCompareCurrentMonth(new Date(compareToDate));
                            const nextMonth = new Date(compareToDate);
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            setCompareCurrentMonth2(nextMonth);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-600 hover:text-orange-700"
                      >
                        <Calendar className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Compare Calendar View */}
              {showCompareCalendar && (
                <div className="border border-gray-200 rounded-lg p-2 md:p-4 bg-white shadow-lg z-50 mt-4 relative w-full max-w-full overflow-x-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 min-w-[280px] sm:min-w-[600px] sm:min-w-0">
                    {/* First Compare Calendar */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => navigateYear('prev', true, 0)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Previous year"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <ChevronLeft className="h-4 w-4 -ml-2" />
                          </button>
                          <button
                            onClick={() => navigateMonth('prev', true, 0)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Previous month"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {compareCurrentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="w-20" />
                      </div>
                      {renderCalendar(compareCurrentMonth, compareFromDate, compareToDate, true)}
                    </div>
                    {/* Second Compare Calendar */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-20" />
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {compareCurrentMonth2.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => navigateMonth('next', true, 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Next month"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => navigateYear('next', true, 1)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Next year"
                          >
                            <ChevronRight className="h-4 w-4" />
                            <ChevronRight className="h-4 w-4 -ml-2" />
                          </button>
                        </div>
                      </div>
                      {renderCalendar(compareCurrentMonth2, compareFromDate, compareToDate, true)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info and Actions */}
      <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-gray-200">
        <p className="text-xs sm:text-sm text-gray-500 mb-3 md:mb-4">
          Data available till last synced date: {formatDate(new Date())}
        </p>
        <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleApply(e);
            }}
            disabled={!fromDate || !toDate || (compareEnabled && (!compareFromDate || !compareToDate))}
            className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
