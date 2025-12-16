'use client';

import { useState, useEffect, useMemo } from 'react';
import { attendanceAPI, employeesAPI, projectsAPI, AttendanceRecord, Employee, Project } from '@/lib/api';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import Input from '@/components/Input';
import SearchableSelect from '@/components/SearchableSelect';
import { Plus, Search, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { lastEndDateAPI } from '@/lib/api';
import LastEndDateBadge from '@/components/LastEndDateBadge';
import Pagination from '@/components/Pagination';

const ITEMS_PER_PAGE = 10;

export default function AttendancePage() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [workers, setWorkers] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [lastEndDates, setLastEndDates] = useState<Record<string, string | null>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Form state for manual attendance
  const [formData, setFormData] = useState({
    user_id: '',
    check_in_time: new Date().toISOString().slice(0, 16),
    check_out_time: '',
    latitude: '',
    longitude: '',
  });

  useEffect(() => {
    fetchWorkers();
    fetchProjects();
    fetchAttendance();
    fetchLastEndDates();
  }, []);

  const fetchLastEndDates = async () => {
    try {
      if (workers.length === 0) return;
      
      const employeeIds = workers.map(w => w.id);
      const response = await lastEndDateAPI.getAll({ employeeIds });
      const datesMap: Record<string, string | null> = {};
      
      (response.lastEndDates || []).forEach((item: any) => {
        // Map by employee_id from response
        datesMap[item.employee_id] = item.last_end_date;
      });
      
      setLastEndDates(datesMap);
    } catch (err: any) {
      console.error('Error fetching last end dates:', err);
    }
  };

  useEffect(() => {
    fetchAttendance();
    setCurrentPage(1); // Reset to first page when filters change
  }, [statusFilter, projectFilter, employeeFilter]);

  useEffect(() => {
    if (workers.length > 0) {
      fetchLastEndDates();
    }
  }, [workers]);

  const fetchWorkers = async () => {
    try {
      const response = await employeesAPI.getAll();
      setWorkers(response.employees || []);
    } catch (err: any) {
      console.error('Error fetching workers:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params: any = {
        sortBy: 'check_in_time',
        sortOrder: 'desc',
      };

      // Show records from the last 7 days by default instead of just today
      // This ensures users see data even if there's no attendance today
      // You can uncomment the line below to filter by today only:
      // const today = new Date().toISOString().split('T')[0];
      // params.date = today;

      const response = await attendanceAPI.getAll(params);
      setAttendanceRecords(response.records || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload: any = {
        user_id: formData.user_id,
      };

      if (formData.check_in_time) {
        payload.check_in_time = new Date(formData.check_in_time).toISOString();
      }
      if (formData.check_out_time) {
        payload.check_out_time = new Date(formData.check_out_time).toISOString();
      }
      if (formData.latitude) {
        payload.latitude = parseFloat(formData.latitude);
      }
      if (formData.longitude) {
        payload.longitude = parseFloat(formData.longitude);
      }

      await attendanceAPI.create(payload);
      setIsAddModalOpen(false);
      setFormData({
        user_id: '',
        check_in_time: new Date().toISOString().slice(0, 16),
        check_out_time: '',
        latitude: '',
        longitude: '',
      });
      fetchAttendance();
      fetchLastEndDates();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create attendance record');
    }
  };

  // Calculate statistics for today
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter((record) => {
      const recordDate = new Date(record.check_in_time).toISOString().split('T')[0];
      return recordDate === today;
    });

    const checkedIn = todayRecords.filter((record) => !record.check_out_time);
    const checkedOut = todayRecords.filter((record) => record.check_out_time);
    const totalToday = todayRecords.length;

    return {
      checkedIn: checkedIn.length,
      checkedOut: checkedOut.length,
      totalToday,
    };
  }, [attendanceRecords]);

  // Filter and search attendance records
  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords;

    // Apply employee filter
    if (employeeFilter) {
      filtered = filtered.filter((record) => record.user_id === employeeFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((record) => {
        const worker = workers.find((w) => w.id === record.user_id);
        const workerName = worker?.name?.toLowerCase() || '';
        const workerEmail = worker?.email?.toLowerCase() || '';
        const projectName = worker?.projects?.name?.toLowerCase() || '';
        
        return (
          workerName.includes(query) ||
          workerEmail.includes(query) ||
          projectName.includes(query)
        );
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'checked-in') {
        filtered = filtered.filter((record) => !record.check_out_time);
      } else if (statusFilter === 'checked-out') {
        filtered = filtered.filter((record) => record.check_out_time);
      }
    }

    // Apply project filter
    if (projectFilter && projectFilter !== 'all') {
      filtered = filtered.filter((record) => {
        const worker = workers.find((w) => w.id === record.user_id);
        return worker?.project_id === projectFilter;
      });
    }

    return filtered;
  }, [attendanceRecords, searchQuery, statusFilter, projectFilter, employeeFilter, workers]);

  // Paginate filtered records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length);

  const columns = [
    {
      key: 'worker',
      header: 'Staff',
      render: (item: AttendanceRecord) => {
        const worker = workers.find((w) => w.id === item.user_id);
        return (
          <div>
            <span className="font-medium text-gray-900">{worker?.name || item.user_email || 'N/A'}</span>
            {worker?.projects && (
              <p className="text-xs text-gray-500 mt-0.5">{worker.projects.name}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'check_in_time',
      header: 'Check In',
      render: (item: AttendanceRecord) => {
        const date = new Date(item.check_in_time);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return (
          <span className="text-sm text-gray-900">
            {displayHours}:{String(minutes).padStart(2, '0')} {ampm}
          </span>
        );
      },
    },
    {
      key: 'check_out_time',
      header: 'Check Out',
      render: (item: AttendanceRecord) => {
        if (!item.check_out_time) {
          return <span className="text-gray-400">-</span>;
        }
        const date = new Date(item.check_out_time);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return (
          <span className="text-sm text-gray-900">
            {displayHours}:{String(minutes).padStart(2, '0')} {ampm}
          </span>
        );
      },
    },
    {
      key: 'hours',
      header: 'Hours',
      render: (item: AttendanceRecord) => {
        if (!item.check_out_time) {
          return <span className="text-gray-400">-</span>;
        }
        const checkIn = new Date(item.check_in_time);
        const checkOut = new Date(item.check_out_time);
        const diff = checkOut.getTime() - checkIn.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return <span className="text-sm text-gray-900">{hours}h {minutes}m</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AttendanceRecord) => {
        if (item.check_out_time) {
          return (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              PRESENT
            </span>
          );
        }
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            CHECKED IN
          </span>
        );
      },
    },
    {
      key: 'last_end_date',
      header: 'Last End Date',
      render: (item: AttendanceRecord) => {
        const worker = workers.find((w) => w.id === item.user_id);
        const lastEndDate = worker ? lastEndDates[worker.id] : null;
        return <LastEndDateBadge lastEndDate={lastEndDate} />;
      },
    },
  ];

  if (loading && attendanceRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading attendance records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
        <p className="text-gray-600 mt-1">Track staff attendance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Checked In"
          value={todayStats.checkedIn}
          subtitle="Currently at work"
          icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
        />
        <StatCard
          title="Checked Out"
          value={todayStats.checkedOut}
          subtitle="Completed today"
          icon={<XCircle className="h-6 w-6 text-red-600" />}
        />
        <StatCard
          title="Total Today"
          value={todayStats.totalToday}
          subtitle="Attendance records"
          icon={<Calendar className="h-6 w-6 text-blue-600" />}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1 w-full">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page on search change
              }}
              placeholder="Search by staff name, email, or project..."
              className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            </div>
          </div>
          <div className="w-full sm:w-auto min-w-[150px]">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="checked-in">Checked In</option>
              <option value="checked-out">Checked Out</option>
            </select>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <Plus className="h-5 w-5" />
            <span>Add Manual</span>
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-full sm:w-auto min-w-[200px]">
            <SearchableSelect
              options={[
                { value: '', label: 'All Employees' },
                ...workers.map((worker) => ({
                  value: worker.id,
                  label: worker.name || worker.email || 'Unknown',
                })),
              ]}
              value={employeeFilter}
              onChange={(value) => {
                setEmployeeFilter(value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              placeholder="Filter by employee"
              searchPlaceholder="Search employees..."
            />
          </div>
          <div className="w-full sm:w-auto min-w-[200px]">
            <SearchableSelect
              options={[
                { value: 'all', label: 'All Projects' },
                ...projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
              value={projectFilter}
              onChange={(value) => {
                setProjectFilter(value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              placeholder="Filter by project"
              searchPlaceholder="Search projects..."
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Attendance Records */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No attendance records found</p>
          <p className="text-sm text-gray-400 mt-2">Try adding manual attendance or check if workers have checked in</p>
        </div>
      ) : (
        <>
          {filteredRecords.length > 0 && (
            <p className="text-sm text-gray-600 mb-4">
              Showing {startIndex} - {endIndex} of {filteredRecords.length} records
            </p>
          )}
          <Table
            columns={columns}
            data={paginatedRecords}
            keyExtractor={(item) => item.id}
            emptyMessage="No attendance records found"
          />
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Add Manual Attendance Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFormData({
            user_id: '',
            check_in_time: new Date().toISOString().slice(0, 16),
            check_out_time: '',
            latitude: '',
            longitude: '',
          });
          setError('');
        }}
        title="Add Manual Attendance"
        size="lg"
      >
        <form onSubmit={handleAddAttendance} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Staff *
            </label>
            <select
              value={formData.user_id}
              onChange={(e) =>
                setFormData({ ...formData, user_id: e.target.value })
              }
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            >
              <option value="">Select Staff</option>
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} {worker.email ? `(${worker.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Check In Time"
            type="datetime-local"
            value={formData.check_in_time}
            onChange={(e) =>
              setFormData({ ...formData, check_in_time: e.target.value })
            }
            required
          />

          <Input
            label="Check Out Time (Optional)"
            type="datetime-local"
            value={formData.check_out_time}
            onChange={(e) =>
              setFormData({ ...formData, check_out_time: e.target.value })
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude (Optional)"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) =>
                setFormData({ ...formData, latitude: e.target.value })
              }
              placeholder="e.g., 1.2787"
            />
            <Input
              label="Longitude (Optional)"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) =>
                setFormData({ ...formData, longitude: e.target.value })
              }
              placeholder="e.g., 103.8577"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setFormData({
                  user_id: '',
                  check_in_time: new Date().toISOString().slice(0, 16),
                  check_out_time: '',
                  latitude: '',
                  longitude: '',
                });
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Attendance
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
