'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserCog, Mail, Phone, Calendar, Building2, MapPin, DollarSign, ChevronRight, Loader2, Eye, FolderKanban } from 'lucide-react';
import Pagination from '@/components/Pagination';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  is_active: boolean;
  project_count: number;
  assigned_projects?: Project[];
}

interface Project {
  id: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  budget?: number;
  client_user_id?: string;
  client_name?: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 9;

export default function SupervisorDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supervisorId = params.id as string;

  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (supervisorId) {
      fetchSupervisorDetails();
    }
  }, [supervisorId]);

  const fetchSupervisorDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/proxy/supervisors/${supervisorId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch supervisor details');
      }

      const data = await response.json();
      console.log('Supervisor data received:', data);
      
      if (data.success && data.data) {
        setSupervisor(data.data);
      } else if (data.data) {
        setSupervisor(data.data);
      } else {
        setSupervisor(data);
      }
      
      // Reset to first page when supervisor data is loaded
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Error fetching supervisor details:', err);
      setError(err.message || 'Failed to load supervisor details');
    } finally {
      setLoading(false);
    }
  };

  // Format budget
  const formatBudget = (budget: number | string | null | undefined) => {
    if (!budget) return null;
    const num = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (isNaN(num)) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Determine project status
  const getProjectStatus = (project: Project) => {
    if (project.end_date && new Date(project.end_date) <= new Date()) {
      return { label: 'Completed', color: 'bg-green-100 text-green-800' };
    }
    if (project.end_date && new Date(project.end_date) < new Date()) {
      return { label: 'Overdue', color: 'bg-red-100 text-red-800' };
    }
    return { label: 'Active', color: 'bg-blue-100 text-blue-800' };
  };

  // Pagination logic - MUST be before any conditional returns (Rules of Hooks)
  // All hooks must be called in the same order on every render
  const assignedProjects = supervisor?.assigned_projects || [];
  const totalPages = Math.ceil(assignedProjects.length / ITEMS_PER_PAGE);
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return assignedProjects.slice(startIndex, endIndex);
  }, [assignedProjects, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of projects section when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !supervisor) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Supervisor not found'}
        </div>
        <Link
          href="/supervisors"
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          ← Back to Supervisors
        </Link>
      </div>
    );
  }

  if (!supervisor) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Supervisor not found
        </div>
        <Link
          href="/supervisors"
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          ← Back to Supervisors
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600">
        <Link href="/supervisors" className="hover:text-primary-600 transition-colors">
          Supervisors
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{supervisor.name}</span>
      </nav>

      {/* Supervisor Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <UserCog className="h-8 w-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{supervisor.name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{supervisor.email}</span>
                </div>
                {supervisor.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{supervisor.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4" />
                  <span>Joined: {new Date(supervisor.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                supervisor.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {supervisor.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Assigned Projects</p>
              <p className="text-3xl font-bold text-primary-600">{assignedProjects.length}</p>
            </div>
            <FolderKanban className="h-12 w-12 text-primary-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-blue-600">
                {assignedProjects.filter(p => {
                  const status = getProjectStatus(p);
                  return status.label === 'Active';
                }).length}
              </p>
            </div>
            <FolderKanban className="h-12 w-12 text-blue-200" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed Projects</p>
              <p className="text-3xl font-bold text-green-600">
                {assignedProjects.filter(p => {
                  const status = getProjectStatus(p);
                  return status.label === 'Completed';
                }).length}
              </p>
            </div>
            <FolderKanban className="h-12 w-12 text-green-200" />
          </div>
        </div>
      </div>

      {/* Assigned Projects Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Assigned Projects</h2>
          <p className="text-sm text-gray-600 mt-1">
            Projects currently assigned to this supervisor
          </p>
        </div>

        <div className="p-6">
          {assignedProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderKanban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No projects assigned to this supervisor</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedProjects.map((project) => {
                const status = getProjectStatus(project);
                const budget = formatBudget(project.budget);

                return (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 flex-1">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-2 ml-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${status.color}`}
                        >
                          {status.label}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${project.id}`);
                          }}
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="View Project"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {project.client_name && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Building2 className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{project.client_name}</span>
                        </div>
                      )}
                      {project.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{project.location}</span>
                        </div>
                      )}
                      {project.start_date && project.end_date && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {budget && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <DollarSign className="h-4 w-4 flex-shrink-0" />
                          <span>{budget}</span>
                        </div>
                      )}
                    </div>

                    {project.description && (
                      <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                );
              })}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
              
              {/* Results info */}
              {assignedProjects.length > 0 && (
                <div className="mt-4 text-center text-sm text-gray-600">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, assignedProjects.length)} of{' '}
                  {assignedProjects.length} projects
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

