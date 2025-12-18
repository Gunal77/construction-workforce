'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { projectsAPI, employeesAPI, Project, Employee, ProjectEmployee } from '@/lib/api';
import { MapPin, Calendar, DollarSign, Building2, Users, UserCheck, Check, Loader2, Search, UserMinus, ChevronRight, Edit, Trash2, X } from 'lucide-react';
import { getClientById, ClientData } from '@/app/actions/clientActions';
import AssignEmployeesModal from '@/components/AssignEmployeesModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ReassignEmployeeModal from '@/components/ReassignEmployeeModal';

type Tab = 'overview' | 'assign-staffs' | 'assign-supervisor' | 'assigned-employees';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState<string>('admin');

  // Staff assignment state
  const [allStaffs, setAllStaffs] = useState<Employee[]>([]);
  const [assignedStaffs, setAssignedStaffs] = useState<Employee[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [loadingStaffs, setLoadingStaffs] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Supervisor assignment state
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [currentSupervisorId, setCurrentSupervisorId] = useState<string | null>(null);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  // Assigned Employees state
  const [assignedEmployees, setAssignedEmployees] = useState<ProjectEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [isAssignEmployeesModalOpen, setIsAssignEmployeesModalOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [employeeToRevoke, setEmployeeToRevoke] = useState<ProjectEmployee | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [employeeToReassign, setEmployeeToReassign] = useState<ProjectEmployee | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    // Fetch user role and project data in parallel
    Promise.all([
      fetchUserRole(),
      projectId ? fetchProjectData() : Promise.resolve(),
    ]);
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'assigned-employees' && project) {
      fetchAssignedEmployees();
    }
  }, [activeTab, project]);

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const role = data.data?.role || data.role || data.user?.role || 'admin';
        setUserRole(role?.toLowerCase() || 'admin');
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('admin');
    }
  };

  const fetchProjectData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Fetch all data in parallel for maximum performance
      const [projectRes, staffsRes, allStaffsRes, supervisorsRes] = await Promise.allSettled([
        projectsAPI.getById(projectId),
        projectsAPI.getProjectStaffs(projectId),
        employeesAPI.getAll(),
        projectsAPI.getSupervisors(),
      ]);

      // Handle project data
      if (projectRes.status === 'fulfilled' && projectRes.value.project) {
        const projectData = projectRes.value.project;
        setProject(projectData);
        
        // Fetch client in parallel (non-blocking)
        if (projectData.client_user_id) {
          getClientById(projectData.client_user_id).then(clientRes => {
            if (clientRes.success && clientRes.data) {
              setClient(clientRes.data);
            }
          }).catch(err => {
            console.error('Error fetching client:', err);
          });
        }

        // Set supervisor info
        if (projectData.supervisor_id) {
          setCurrentSupervisorId(projectData.supervisor_id);
          setSelectedSupervisorId(projectData.supervisor_id);
        } else {
          setCurrentSupervisorId(null);
          setSelectedSupervisorId('');
        }
      }

      // Handle staffs
      if (staffsRes.status === 'fulfilled') {
        const staffs = staffsRes.value.staffs || [];
        setAssignedStaffs(staffs);
        setSelectedStaffIds(staffs.map((s: Employee) => s.id));
      }

      // Handle all staffs
      if (allStaffsRes.status === 'fulfilled') {
        setAllStaffs(allStaffsRes.value.employees || []);
      }

      // Handle supervisors
      if (supervisorsRes.status === 'fulfilled') {
        setSupervisors(supervisorsRes.value.supervisors || []);
      }
    } catch (err: any) {
      console.error('Error fetching project data:', err);
      setError(err.response?.data?.message || 'Failed to fetch project data');
    } finally {
      setLoading(false);
      setLoadingSupervisors(false);
    }
  };

  const fetchAssignedEmployees = async () => {
    if (!project) return;

    try {
      setLoadingEmployees(true);
      const data = await projectsAPI.getAssignedEmployees(project.id);
      setAssignedEmployees(data.employees || []);
    } catch (err: any) {
      console.error('Error fetching assigned employees:', err);
      setError(err.response?.data?.message || 'Failed to fetch assigned employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleStaffToggle = (staffId: string) => {
    if (!isAdmin) return;
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleAssignStaffs = async () => {
    if (!project || !isAdmin) return;

    try {
      setLoadingStaffs(true);
      setError('');
      setSuccess('');

      await projectsAPI.assignStaffs(project.id, selectedStaffIds);

      setSuccess(`Successfully assigned ${selectedStaffIds.length} staff(s) to project`);
      await fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign staffs');
    } finally {
      setLoadingStaffs(false);
    }
  };

  const handleRemoveStaff = async (staffId: string) => {
    if (!project || !isAdmin) return;

    try {
      setLoadingStaffs(true);
      setError('');
      setSuccess('');

      await projectsAPI.removeStaff(project.id, staffId);

      setSuccess('Staff removed from project successfully');
      await fetchProjectData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove staff');
    } finally {
      setLoadingStaffs(false);
    }
  };

  const handleAssignSupervisor = async () => {
    if (!project || !isAdmin) return;
    
    // Don't proceed if no change
    if (selectedSupervisorId === currentSupervisorId) {
      return;
    }

    try {
      setLoadingSupervisors(true);
      setError('');
      setSuccess('');

      const response = await fetch(`/api/proxy/projects/${project.id}/assign-supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisor_id: selectedSupervisorId || null }),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw { response: { status: response.status, data } };
      }
      
      setSuccess(selectedSupervisorId ? 'Supervisor assigned successfully' : 'Supervisor removed successfully');
      
      // Update state immediately for better UX
      if (selectedSupervisorId) {
        setCurrentSupervisorId(selectedSupervisorId);
        setSelectedSupervisorId(selectedSupervisorId);
      } else {
        setCurrentSupervisorId(null);
        setSelectedSupervisorId('');
      }

      // Refresh project data to ensure consistency (with a small delay to allow backend to update)
      setTimeout(async () => {
        await fetchProjectData();
      }, 500);
    } catch (err: any) {
      console.error('Error assigning supervisor:', err);
      setError(err.response?.data?.message || 'Failed to assign supervisor');
      // Revert selection on error
      setSelectedSupervisorId(currentSupervisorId || '');
    } finally {
      setLoadingSupervisors(false);
    }
  };

  const handleRevokeEmployee = async () => {
    if (!project || !employeeToRevoke || !isAdmin) return;

    try {
      setRevoking(true);
      setError('');
      setSuccess('');

      await projectsAPI.revokeEmployee(project.id, employeeToRevoke.employee_id);

      setSuccess('Employee revoked successfully');
      setIsRevokeDialogOpen(false);
      setEmployeeToRevoke(null);
      await fetchAssignedEmployees();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to revoke employee');
    } finally {
      setRevoking(false);
    }
  };

  const handleAssignSuccess = async () => {
    await fetchAssignedEmployees();
    await fetchProjectData();
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

  if (loading && !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Project not found'}
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Project not found
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center text-primary-600 hover:text-primary-700"
        >
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const budget = formatBudget(project.budget);
  const isCompleted = project.end_date && new Date(project.end_date) <= new Date();
  const isOverdue = project.end_date && new Date(project.end_date) < new Date() && !isCompleted;
  const status = isCompleted ? 'completed' : (project.status === 'on_hold' || project.status === 'ON HOLD' ? 'on_hold' : 'active');

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-gray-600">
        <Link href="/projects" className="hover:text-primary-600 transition-colors">
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-gray-900 font-medium">{project.name}</span>
      </nav>

      {/* Project Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                  isOverdue
                    ? 'bg-red-100 text-red-800'
                    : status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : status === 'on_hold'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isOverdue ? 'Overdue' : status === 'completed' ? 'Completed' : status === 'on_hold' ? 'On Hold' : 'Active'}
              </span>
            </div>
            {project.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{project.location}</span>
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // TODO: Implement edit functionality
                  console.log('Edit project:', project.id);
                }}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                title="Edit Project"
              >
                <Edit className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  // TODO: Implement delete functionality
                  console.log('Delete project:', project.id);
                }}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                title="Delete Project"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('assign-staffs')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'assign-staffs'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Assign Staffs
            </button>
            <button
              onClick={() => setActiveTab('assign-supervisor')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'assign-supervisor'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Assign Supervisor
            </button>
            <button
              onClick={() => setActiveTab('assigned-employees')}
              className={`py-4 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'assigned-employees'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Assigned Employees
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {client && (
                    <div className="flex items-start space-x-3">
                      <Building2 className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Client</p>
                        <p className="text-gray-900 font-medium">{client.name}</p>
                      </div>
                    </div>
                  )}
                  {project.start_date && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Start Date</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(project.start_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {project.end_date && (
                    <div className="flex items-start space-x-3">
                      <Calendar className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">End Date</p>
                        <p className="text-gray-900 font-medium">
                          {new Date(project.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {budget && (
                    <div className="flex items-start space-x-3">
                      <DollarSign className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-500">Budget</p>
                        <p className="text-gray-900 font-medium">{budget}</p>
                      </div>
                    </div>
                  )}
                </div>
                {project.description && (
                  <div className="mt-6">
                    <p className="text-sm text-gray-500 mb-2">Description</p>
                    <p className="text-gray-900">{project.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assign Staffs Tab - Copy from modal */}
          {activeTab === 'assign-staffs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Staffs ({selectedStaffIds.length} selected)
                </h3>
                {isAdmin && (
                  <button
                    onClick={handleAssignStaffs}
                    disabled={loadingStaffs || selectedStaffIds.length === 0}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingStaffs ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Assignments</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isAdmin && (
                <p className="text-sm text-gray-500 italic">Read-only view. Only admins can assign staffs.</p>
              )}

              {/* Assigned Staffs */}
              {assignedStaffs.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Currently Assigned Staffs</h4>
                  </div>
                  <div className="space-y-2 border border-gray-200 rounded-lg p-4">
                    {assignedStaffs.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedStaffIds.includes(staff.id)}
                            onChange={() => handleStaffToggle(staff.id)}
                            disabled={!isAdmin}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{staff.name}</p>
                            {staff.email && <p className="text-sm text-gray-500">{staff.email}</p>}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleRemoveStaff(staff.id)}
                            disabled={loadingStaffs}
                            className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Remove from project"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Available Staffs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">All Available Staffs</h4>
                </div>
                
                {/* Search Input with Button */}
                <div className="mb-4 flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search by name, email, or role..."
                      value={staffSearchQuery}
                      onChange={(e) => setStaffSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Search by name, email, or role..."]') as HTMLInputElement;
                      if (input) input.focus();
                    }}
                  >
                    <Search className="h-5 w-5" />
                    <span>Search</span>
                  </button>
                </div>

                {/* Filtered Staff List */}
                <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-4">
                  {(() => {
                    const filteredStaffs = allStaffs.filter((staff) => {
                      if (!staffSearchQuery.trim()) return true;
                      const query = staffSearchQuery.toLowerCase();
                      return (
                        staff.name?.toLowerCase().includes(query) ||
                        staff.email?.toLowerCase().includes(query) ||
                        staff.role?.toLowerCase().includes(query)
                      );
                    });

                    if (filteredStaffs.length === 0) {
                      return (
                        <p className="text-sm text-gray-500 text-center py-4">
                          {staffSearchQuery ? 'No staffs found matching your search' : 'No staffs available'}
                        </p>
                      );
                    }

                    return filteredStaffs.map((staff) => (
                      <div
                        key={staff.id}
                        className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStaffIds.includes(staff.id)}
                          onChange={() => handleStaffToggle(staff.id)}
                          disabled={!isAdmin}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{staff.name}</p>
                          {staff.email && <p className="text-sm text-gray-500">{staff.email}</p>}
                          {staff.role && <p className="text-xs text-gray-400">{staff.role}</p>}
                        </div>
                        {staff.project_id && staff.project_id !== project.id && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            Assigned to another project
                          </span>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Assign Supervisor Tab - Copy from modal */}
          {activeTab === 'assign-supervisor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Assign Supervisor</h3>
                {isAdmin && (
                  <button
                    onClick={handleAssignSupervisor}
                    disabled={loadingSupervisors || selectedSupervisorId === currentSupervisorId || !selectedSupervisorId}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingSupervisors ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save Supervisor</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {!isAdmin && (
                <p className="text-sm text-gray-500 italic">Read-only view. Only admins can assign supervisors.</p>
              )}

              {/* Currently Assigned Supervisor */}
              {currentSupervisorId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">Currently Assigned Supervisor</h4>
                      {(() => {
                        const assignedSupervisor = supervisors.find((s) => s.id === currentSupervisorId);
                        return assignedSupervisor ? (
                          <div className="mt-2">
                            <p className="text-sm font-medium text-gray-900">
                              {assignedSupervisor.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {assignedSupervisor.email}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500 italic">Supervisor ID: {currentSupervisorId}</p>
                            <p className="text-xs text-gray-400">Loading details...</p>
                          </div>
                        );
                      })()}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          if (!project || !isAdmin) return;
                          try {
                            setLoadingSupervisors(true);
                            setError('');
                            setSuccess('');
                            
                            const response = await fetch(`/api/proxy/projects/${project.id}/assign-supervisor`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ supervisor_id: null }),
                              credentials: 'include',
                            });
                            const data = await response.json();
                            if (!response.ok) {
                              throw { response: { status: response.status, data } };
                            }
                            setSuccess('Supervisor removed successfully');
                            setSelectedSupervisorId('');
                            setCurrentSupervisorId(null);
                            await fetchProjectData();
                          } catch (err: any) {
                            console.error('Error removing supervisor:', err);
                            setError(err.response?.data?.message || 'Failed to remove supervisor');
                          } finally {
                            setLoadingSupervisors(false);
                          }
                        }}
                        disabled={loadingSupervisors}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        title="Remove supervisor"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Select Supervisor */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Supervisor</h4>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">-- Select a supervisor --</option>
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} {supervisor.email ? `(${supervisor.email})` : ''}
                    </option>
                  ))}
                </select>
                {supervisors.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500 italic">No supervisors available</p>
                )}
              </div>
            </div>
          )}

          {/* Assigned Employees Tab - Copy from modal */}
          {activeTab === 'assigned-employees' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assigned Employees ({assignedEmployees.length})
                </h3>
                {isAdmin && (
                  <button
                    onClick={() => setIsAssignEmployeesModalOpen(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    <span>Assign Employees</span>
                  </button>
                )}
              </div>

              {!isAdmin && (
                <p className="text-sm text-gray-500 italic">
                  Read-only view. Only admins can assign or revoke employees.
                </p>
              )}

              {loadingEmployees ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : assignedEmployees.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No employees assigned to this project yet</p>
                  {isAdmin && (
                    <button
                      onClick={() => setIsAssignEmployeesModalOpen(true)}
                      className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      <span>Assign Employees</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Employee Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Role / Trade
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Assignment Period
                            </th>
                            {isAdmin && (
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Action
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assignedEmployees.map((assignment) => (
                            <tr key={assignment.id} className="group hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {assignment.employee_name || 'Unknown'}
                                  </div>
                                  {assignment.employee_email && (
                                    <div className="text-sm text-gray-500">
                                      {assignment.employee_email}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">
                                  {assignment.employee_role || 'N/A'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    assignment.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {assignment.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {assignment.assignment_start_date && assignment.assignment_end_date ? (
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {new Date(assignment.assignment_start_date).toLocaleDateString()} - {new Date(assignment.assignment_end_date).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                ) : assignment.assigned_at ? (
                                  <div>
                                    <div className="text-gray-500">No specific period</div>
                                    <div className="text-xs text-gray-500">
                                      Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                ) : (
                                  'N/A'
                                )}
                              </td>
                              {isAdmin && (
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <div className="flex items-center justify-end gap-1.5 min-w-[140px]">
                                    <button
                                      onClick={() => {
                                        setEmployeeToReassign(assignment);
                                        setIsReassignModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-all duration-200 border border-transparent hover:border-blue-200"
                                      title="Reassign to another project"
                                    >
                                      <UserCheck className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-xs font-medium">Reassign</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEmployeeToRevoke(assignment);
                                        setIsRevokeDialogOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-all duration-200 border border-transparent hover:border-red-200"
                                      title="Revoke from project"
                                    >
                                      <UserMinus className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-xs font-medium">Revoke</span>
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AssignEmployeesModal
        isOpen={isAssignEmployeesModalOpen}
        onClose={() => setIsAssignEmployeesModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onAssignSuccess={handleAssignSuccess}
      />

      <ReassignEmployeeModal
        isOpen={isReassignModalOpen}
        onClose={() => {
          setIsReassignModalOpen(false);
          setEmployeeToReassign(null);
        }}
        employee={employeeToReassign}
        currentProjectId={project.id}
        currentProjectName={project.name}
        onReassignSuccess={handleAssignSuccess}
      />

      <ConfirmDialog
        isOpen={isRevokeDialogOpen}
        onClose={() => {
          setIsRevokeDialogOpen(false);
          setEmployeeToRevoke(null);
        }}
        onConfirm={handleRevokeEmployee}
        title="Revoke Employee"
        message={`Are you sure you want to revoke ${employeeToRevoke?.employee_name || 'this employee'} from the project? This will make the employee available for assignment to other projects.`}
        confirmText="Revoke"
        cancelText="Cancel"
        isDestructive={true}
        isLoading={revoking}
      />
    </div>
  );
}
