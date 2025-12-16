'use client';

import { useState, useEffect } from 'react';
import { Project, projectsAPI, employeesAPI } from '@/lib/api';
import Modal from './Modal';
import { MapPin, Calendar, DollarSign, Building2, Users, UserCheck, X, Check, Loader2, Search } from 'lucide-react';
import { Employee } from '@/lib/api';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  clientName?: string;
  isAdmin?: boolean;
  onUpdate?: () => void;
}

type Tab = 'overview' | 'assign-staffs' | 'assign-supervisor';

interface Supervisor {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export default function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  clientName,
  isAdmin = true, // Default to true for admin portal
  onUpdate,
}: ProjectDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  // Project details state
  const [projectDetails, setProjectDetails] = useState<Project | null>(project);

  useEffect(() => {
    if (isOpen && project) {
      setProjectDetails(project);
      setActiveTab('overview');
      setError('');
      setSuccess('');
      fetchProjectData();
    }
  }, [isOpen, project]);

  const fetchProjectData = async () => {
    if (!project) return;

    try {
      setLoading(true);

      // Fetch fresh project data to get updated supervisor info
      const projectRes = await projectsAPI.getById(project.id);
      if (projectRes.project) {
        setProjectDetails(projectRes.project);
      }

      // Fetch assigned staffs
      const staffsRes = await projectsAPI.getProjectStaffs(project.id);
      setAssignedStaffs(staffsRes.staffs || []);
      setSelectedStaffIds((staffsRes.staffs || []).map((s: Employee) => s.id));

      // Fetch all staffs
      const allStaffsRes = await employeesAPI.getAll();
      setAllStaffs(allStaffsRes.employees || []);

      // Fetch supervisors
      setLoadingSupervisors(true);
      const supervisorsRes = await projectsAPI.getSupervisors();
      setSupervisors(supervisorsRes.supervisors || []);

      // Get updated project data for supervisor
      const updatedProject = projectRes.project || project;
      if (updatedProject.supervisor_id) {
        setCurrentSupervisorId(updatedProject.supervisor_id);
        setSelectedSupervisorId(updatedProject.supervisor_id);
      } else {
        setCurrentSupervisorId(null);
        setSelectedSupervisorId('');
      }
    } catch (err: any) {
      console.error('Error fetching project data:', err);
      setError(err.response?.data?.message || 'Failed to fetch project data');
    } finally {
      setLoading(false);
      setLoadingSupervisors(false);
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
      onUpdate?.();
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
      onUpdate?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove staff');
    } finally {
      setLoadingStaffs(false);
    }
  };

  const handleAssignSupervisor = async () => {
    if (!project || !isAdmin) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Use the assign-supervisor endpoint (handles both assign and remove)
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

      await fetchProjectData();
      onUpdate?.();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign supervisor');
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

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

  const budget = formatBudget(project.budget);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Project: ${project.name}`} size="xl">
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('assign-staffs')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'assign-staffs'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Assign Staffs
          </button>
          <button
            onClick={() => setActiveTab('assign-supervisor')}
            className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'assign-supervisor'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Assign Supervisor
          </button>
        </nav>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
          {success}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-primary-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Client</p>
                  <p className="text-gray-900 font-medium">{clientName || project.client_name || 'No Client Assigned'}</p>
                </div>
              </div>

              {project.description && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Description</p>
                  <p className="text-gray-900">{project.description}</p>
                </div>
              )}

              {project.location && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="text-gray-900 font-medium">{project.location}</p>
                  </div>
                </div>
              )}

              {(project.start_date || project.end_date) && (
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Date Range</p>
                    <p className="text-gray-900 font-medium">
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}{' '}
                      -{' '}
                      {project.end_date
                        ? new Date(project.end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Ongoing'}
                    </p>
                  </div>
                </div>
              )}

              {budget && (
                <div className="flex items-start space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Budget</p>
                    <p className="text-gray-900 font-medium">{budget}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Staffs Assigned</p>
                  <p className="text-gray-900 font-medium">
                    {assignedStaffs.length} Staff{assignedStaffs.length !== 1 ? 's' : ''} Assigned
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <UserCheck className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Supervisor</p>
                  <p className="text-gray-900 font-medium">
                    {projectDetails?.supervisor_name || project.supervisor_name || 'No Supervisor Assigned'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assign-staffs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Staffs ({selectedStaffIds.length} selected)
            </h3>
            {isAdmin && (
              <button
                onClick={handleAssignStaffs}
                disabled={loadingStaffs}
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
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Currently Assigned Staffs</h4>
              <div className="space-y-2">
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
                      // Search is already live, but Enter can be used to focus
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
                  // Search is already live, but button provides visual feedback
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

      {activeTab === 'assign-supervisor' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Assign Supervisor</h3>
            {isAdmin && (
              <button
                onClick={handleAssignSupervisor}
                disabled={loading || selectedSupervisorId === currentSupervisorId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
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

          {loadingSupervisors ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Currently Assigned Supervisor */}
              {(currentSupervisorId || projectDetails?.supervisor_name) && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Currently Assigned Supervisor</h4>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {projectDetails?.supervisor_name || 
                             supervisors.find((s) => s.id === currentSupervisorId)?.name || 
                             'Unknown'}
                          </p>
                          {supervisors.find((s) => s.id === currentSupervisorId)?.email && (
                            <p className="text-sm text-gray-500">
                              {supervisors.find((s) => s.id === currentSupervisorId)?.email}
                            </p>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            if (!project || !isAdmin) return;
                            try {
                              setLoading(true);
                              setError('');
                              setSuccess('');
                              
                              // Remove supervisor by sending null
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
                              await fetchProjectData();
                              onUpdate?.();
                            } catch (err: any) {
                              setError(err.response?.data?.message || 'Failed to remove supervisor');
                            } finally {
                              setLoading(false);
                            }
                          }}
                          disabled={loading}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                          title="Remove supervisor"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Select Supervisor */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Select Supervisor</h4>
                <select
                  value={selectedSupervisorId}
                  onChange={(e) => setSelectedSupervisorId(e.target.value)}
                  disabled={!isAdmin || loading}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">No Supervisor</option>
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name} {supervisor.email ? `(${supervisor.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

