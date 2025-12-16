'use client';

import { useState, useMemo } from 'react';
import { Employee, lastEndDateAPI } from '@/lib/api';
import Table from './Table';
import LastEndDateBadge from './LastEndDateBadge';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

interface WorkerAttendanceReportTableProps {
  workers: Employee[];
  lastEndDates: Record<string, string | null>;
  onInactiveFilterChange?: (days: number | null) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
}

export default function WorkerAttendanceReportTable({
  workers,
  lastEndDates,
  onInactiveFilterChange,
  currentPage: externalCurrentPage,
  onPageChange: externalOnPageChange,
  itemsPerPage = 10,
}: WorkerAttendanceReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inactiveDays, setInactiveDays] = useState<number | null>(null);
  const [internalPage, setInternalPage] = useState(1);
  
  const currentPage = externalCurrentPage ?? internalPage;
  const onPageChange = externalOnPageChange ?? setInternalPage;

  const filteredWorkers = useMemo(() => {
    let filtered = workers;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((worker) => {
        const name = worker.name?.toLowerCase() || '';
        const email = worker.email?.toLowerCase() || '';
        const role = worker.role?.toLowerCase() || '';
        return name.includes(query) || email.includes(query) || role.includes(query);
      });
    }

    // Apply inactive filter
    if (inactiveDays !== null) {
      filtered = filtered.filter((worker) => {
        const lastEndDate = lastEndDates[worker.id];
        if (!lastEndDate) return true; // Include workers with no end date
        
        const date = new Date(lastEndDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(0, 0, 0, 0);
        
        const diffTime = today.getTime() - endDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays >= inactiveDays;
      });
    }

    return filtered;
  }, [workers, searchQuery, inactiveDays, lastEndDates]);

  const paginatedWorkers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredWorkers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredWorkers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);

  const handleInactiveFilterChange = (days: number | null) => {
    setInactiveDays(days);
    onPageChange(1); // Reset to first page on filter change
    if (onInactiveFilterChange) {
      onInactiveFilterChange(days);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onPageChange(1); // Reset to first page on search change
  };

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      render: (item: Employee) => (
        <div>
          <span className="font-medium text-gray-900">{item.name}</span>
          {item.email && (
            <p className="text-xs text-gray-500 mt-0.5">{item.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (item: Employee) => (
        <span className="text-sm text-gray-900">{item.role || 'N/A'}</span>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      render: (item: Employee) => (
        <span className="text-sm text-gray-900">
          {item.projects?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'last_end_date',
      header: 'Last End Date',
      render: (item: Employee) => (
        <LastEndDateBadge lastEndDate={lastEndDates[item.id]} />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="w-full sm:w-auto min-w-[200px]">
          <select
            value={inactiveDays || ''}
            onChange={(e) => handleInactiveFilterChange(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Workers</option>
            <option value="1">Inactive 1+ days</option>
            <option value="3">Inactive 3+ days</option>
            <option value="7">Inactive 7+ days</option>
            <option value="14">Inactive 14+ days</option>
            <option value="30">Inactive 30+ days</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Showing {filteredWorkers.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredWorkers.length)} of {filteredWorkers.length} workers
      </div>

      {/* Table */}
      <Table
        columns={columns}
        data={paginatedWorkers}
        keyExtractor={(item) => item.id}
        emptyMessage="No workers found"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

