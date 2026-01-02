'use client';

import { useState, useMemo } from 'react';
import { Employee, lastEndDateAPI } from '@/lib/api';
import Table from './Table';
import LastEndDateBadge from './LastEndDateBadge';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';
import { Search, X } from 'lucide-react';

interface WorkerAttendanceReportTableProps {
  workers: Employee[];
  lastEndDates: Record<string, string | null>;
  projects?: any[];
  projectAssignments?: Array<{ project_id: string; employee_id: string; employee_email: string | null; assignment_start_date: string | null; assignment_end_date: string | null }>;
  onInactiveFilterChange?: (days: number | null) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
}

export default function WorkerAttendanceReportTable({
  workers,
  lastEndDates,
  projects = [],
  projectAssignments = [],
  onInactiveFilterChange,
  currentPage: externalCurrentPage,
  onPageChange: externalOnPageChange,
  itemsPerPage = 10,
}: WorkerAttendanceReportTableProps) {
  const [searchInput, setSearchInput] = useState('');
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

  // Create a mapping from employee_id to project_name
  const employeeProjectMap = useMemo(() => {
    const map: Record<string, string> = {};
    const projectMap: Record<string, any> = {};
    
    // Create project lookup map
    projects.forEach((project: any) => {
      projectMap[project.id] = project;
    });
    
    // Get current date to check active assignments
    const now = new Date();
    
    // Map employees to their active project assignments
    projectAssignments.forEach((assignment: any) => {
      const employeeId = assignment.employee_id;
      const projectId = assignment.project_id;
      
      // Check if assignment is active
      const isActive = !assignment.assignment_end_date || new Date(assignment.assignment_end_date) >= now;
      
      if (isActive && projectMap[projectId]) {
        // If employee already has a project, keep the first one found
        // (or you could prioritize by assignment_start_date)
        if (!map[employeeId]) {
          map[employeeId] = projectMap[projectId].name;
        }
      }
    });
    
    return map;
  }, [projects, projectAssignments]);

  const handleInactiveFilterChange = (days: number | null) => {
    setInactiveDays(days);
    onPageChange(1); // Reset to first page on filter change
    if (onInactiveFilterChange) {
      onInactiveFilterChange(days);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput); // Set search query when button clicked
    onPageChange(1); // Reset to first page on search
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    onPageChange(1);
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
          {employeeProjectMap[item.id] || 'Unassigned'}
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
      {/* Filters - Unified filter section at the top */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Search by name, email, or role..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
              title="Clear search and show all workers"
            >
              <span>Clear</span>
            </button>
          )}
        </div>
        <div className="w-full sm:w-auto sm:min-w-[200px]">
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

