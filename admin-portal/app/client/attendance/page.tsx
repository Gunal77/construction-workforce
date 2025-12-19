'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Clock, Calendar, Image, MapPin, Eye } from 'lucide-react';
import Table from '@/components/Table';
import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';

const ITEMS_PER_PAGE = 10;

interface AttendanceRecord {
  id: string;
  user_id: string;
  user_email?: string;
  employee_name?: string;
  employee_role?: string;
  check_in_time: string;
  check_out_time?: string;
  image_url?: string;
  checkout_image_url?: string;
  latitude?: number;
  longitude?: number;
  checkout_latitude?: number;
  checkout_longitude?: number;
  project_id?: string;
  project_name?: string;
}

export default function ClientAttendancePage() {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email: string }>>([]);

  useEffect(() => {
    fetchAttendance();
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchAttendance();
    setCurrentPage(1);
  }, [projectFilter, employeeFilter, dateFilter]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/proxy/client/projects', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('sortBy', 'check_in_time');
      params.append('sortOrder', 'desc');

      if (projectFilter && projectFilter !== 'all') {
        params.append('projectId', projectFilter);
      }

      if (employeeFilter && employeeFilter !== 'all') {
        params.append('employeeId', employeeFilter);
      }

      if (dateFilter) {
        params.append('date', dateFilter);
      }

      const response = await fetch(`/api/proxy/client/attendance?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Failed to fetch attendance',
          message: 'Unknown error'
        }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch attendance');
      }

      const data = await response.json();
      setAttendanceRecords(data.records || []);

      // Extract unique employees for filter
      const uniqueEmployees = Array.from(
        new Map(
          (data.records || [])
            .filter((r: AttendanceRecord) => r.employee_name || r.user_email)
            .map((r: AttendanceRecord) => [
              r.user_id,
              {
                id: r.user_id,
                name: r.employee_name || r.user_email || 'Unknown',
                email: r.user_email || '',
              },
            ])
        ).values()
      );
      setEmployees(uniqueEmployees);
    } catch (err: any) {
      console.error('Error fetching attendance:', err);
      setError(err.message || 'Failed to fetch attendance records');
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    let filtered = attendanceRecords;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.employee_name?.toLowerCase().includes(query) ||
          record.user_email?.toLowerCase().includes(query) ||
          record.project_name?.toLowerCase().includes(query) ||
          record.employee_role?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [attendanceRecords, searchQuery]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length);

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (item: AttendanceRecord) => (
        <div>
          <span className="font-medium text-gray-900">{item.employee_name || item.user_email || 'N/A'}</span>
          {item.employee_role && (
            <p className="text-xs text-gray-500 mt-0.5">{item.employee_role}</p>
          )}
          {item.project_name && (
            <p className="text-xs text-blue-600 mt-0.5">{item.project_name}</p>
          )}
        </div>
      ),
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
          <div>
            <span className="text-sm text-gray-900">
              {displayHours}:{String(minutes).padStart(2, '0')} {ampm}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </p>
          </div>
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
          <div>
            <span className="text-sm text-gray-900">
              {displayHours}:{String(minutes).padStart(2, '0')} {ampm}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </p>
          </div>
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
      key: 'image',
      header: 'Image',
      render: (item: AttendanceRecord) => {
        const hasCheckInImage = !!item.image_url;
        const hasCheckoutImage = !!item.checkout_image_url;
        
        if (!hasCheckInImage && !hasCheckoutImage) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        
        return (
          <div className="flex items-start gap-3">
            {/* Check-in Image */}
            <div className="flex flex-col gap-1">
              {hasCheckInImage ? (
                <button
                  onClick={() => setSelectedImage(item.image_url || null)}
                  className="flex items-center justify-center w-14 h-14 rounded border border-gray-300 hover:border-primary-400 hover:shadow-sm transition-all overflow-hidden bg-gray-50 group mx-auto"
                  title="Check-in Image - Click to preview"
                >
                  <img
                    src={item.image_url}
                    alt="Check-in"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                      }
                    }}
                  />
                </button>
              ) : (
                <div className="flex items-center justify-center w-14 h-14 rounded border border-dashed border-gray-300 bg-gray-50 mx-auto">
                  <Image className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
                </div>
              )}
              <span className="text-[10px] font-medium text-gray-600 text-center">Check-in Image</span>
            </div>
            
            {/* Check-out Image */}
            <div className="flex flex-col gap-1">
              {hasCheckoutImage ? (
                <button
                  onClick={() => setSelectedImage(item.checkout_image_url || null)}
                  className="flex items-center justify-center w-14 h-14 rounded border border-gray-300 hover:border-blue-400 hover:shadow-sm transition-all overflow-hidden bg-gray-50 group mx-auto"
                  title="Check-out Image - Click to preview"
                >
                  <img
                    src={item.checkout_image_url}
                    alt="Check-out"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const parent = img.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                      }
                    }}
                  />
                </button>
              ) : (
                <div className="flex items-center justify-center w-14 h-14 rounded border border-dashed border-gray-300 bg-gray-50 mx-auto">
                  <Image className="h-4 w-4 text-gray-300" strokeWidth={1.5} />
                </div>
              )}
              <span className="text-[10px] font-medium text-gray-600 text-center">Check-out Image</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'location',
      header: 'Location',
      render: (item: AttendanceRecord) => {
        const hasCheckInLocation = item.latitude != null && item.longitude != null;
        const hasCheckoutLocation = item.checkout_latitude != null && item.checkout_longitude != null;
        
        if (!hasCheckInLocation && !hasCheckoutLocation) {
          return <span className="text-gray-400 text-xs">-</span>;
        }
        
        return (
          <div className="space-y-2">
            {/* Check-in Location */}
            {hasCheckInLocation ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-600">Check-in:</span>
                  <span className="text-xs text-gray-500 font-mono">{item.latitude!.toFixed(6)}, {item.longitude!.toFixed(6)}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium transition-colors"
                >
                  <MapPin className="h-3 w-3" />
                  <span>View Map</span>
                </a>
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                <span>Check-in: N/A</span>
              </div>
            )}
            
            {/* Check-out Location */}
            {hasCheckoutLocation ? (
              <div className="space-y-0.5 pt-1 border-t border-gray-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-600">Check-out:</span>
                  <span className="text-xs text-gray-500 font-mono">{item.checkout_latitude!.toFixed(6)}, {item.checkout_longitude!.toFixed(6)}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${item.checkout_latitude},${item.checkout_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
                >
                  <MapPin className="h-3 w-3" />
                  <span>View Map</span>
                </a>
              </div>
            ) : (
              <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                <span>Check-out: N/A</span>
              </div>
            )}
          </div>
        );
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
        <p className="text-gray-600 mt-1">View attendance records for your projects</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px] max-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by employee name, email, or project..."
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => {
                setEmployeeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} {e.email ? `(${e.email})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[220px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && attendanceRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Checked In</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {attendanceRecords.filter(r => !r.check_out_time).length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Present Today</p>
                <p className="text-2xl font-bold text-green-600">
                  {attendanceRecords.filter(r => r.check_out_time).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Records</p>
                <p className="text-2xl font-bold text-blue-600">
                  {attendanceRecords.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      {attendanceRecords.length === 0 && !loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">No attendance records found</p>
          <p className="text-sm text-gray-400">
            Attendance records will appear here once employees check in for your projects.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {startIndex} - {endIndex} of {filteredRecords.length} records
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table
                columns={columns}
                data={paginatedRecords}
                keyExtractor={(item) => item.id}
                emptyMessage="No attendance records found"
              />
            </div>
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Image Viewer Modal */}
      {selectedImage && (
        <Modal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          title="Check-In Photo"
          size="lg"
        >
          <div className="space-y-4">
            <div className="relative w-full h-auto max-h-[70vh] overflow-hidden rounded-lg bg-gray-100">
              <img
                src={selectedImage}
                alt="Check-in photo"
                className="w-full h-auto object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="flex items-center justify-center w-full h-64 text-gray-400"><div class="text-center"><p>Failed to load image</p></div></div>';
                  }
                }}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedImage(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

