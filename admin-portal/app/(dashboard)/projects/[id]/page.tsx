'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { projectsAPI, employeesAPI, Project, Employee } from '@/lib/api';
import Card from '@/components/Card';
import { ArrowLeft, MapPin, Calendar, DollarSign, Users, UserCog, Building2 } from 'lucide-react';
import { getClientById, ClientData } from '@/app/actions/clientActions';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<Employee[]>([]);
  const [assignedSupervisors, setAssignedSupervisors] = useState<any[]>([]);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      fetchAssignedWorkers();
    }
  }, [projectId]);

  useEffect(() => {
    if (project && (project as any).client_user_id) {
      fetchClientDetails((project as any).client_user_id);
    }
  }, [project]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Try to fetch by ID first (new endpoint includes supervisors)
      try {
        const response = await projectsAPI.getById(projectId);
        console.log('Project details response:', response);
        if (response.project) {
          setProject(response.project);
          // Set supervisors if included in response
          if (response.supervisors) {
            console.log('Found supervisors:', response.supervisors);
            setAssignedSupervisors(response.supervisors);
          } else {
            console.log('No supervisors in response');
            setAssignedSupervisors([]);
          }
          return;
        }
      } catch (idErr) {
        console.log('Fetch by ID failed, trying fetch all:', idErr);
      }
      
      // Fallback: fetch all and filter
      const response = await projectsAPI.getAll();
      const projects = response.projects || [];
      const foundProject = projects.find((p: Project) => p.id === projectId);
      
      if (foundProject) {
        setProject(foundProject);
      } else {
        setError('Project not found');
      }
    } catch (err: any) {
      console.error('Error fetching project:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch project details';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedWorkers = async () => {
    try {
      // Fetch all workers and filter by project_id
      const response = await employeesAPI.getAll();
      const workers = (response.employees || []).filter(
        (worker: Employee) => worker.project_id === projectId
      );
      setAssignedWorkers(workers);
    } catch (err: any) {
      console.error('Error fetching assigned workers:', err);
    }
  };

  const fetchClientDetails = async (clientId: string) => {
    try {
      const response = await getClientById(clientId);
      if (response.success && response.data) {
        setClient(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching client details:', err);
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

  // Get regular workers (non-supervisors)
  // Note: Supervisors are now fetched separately from the supervisors table
  const regularWorkers = assignedWorkers;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading project details...</div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Projects</span>
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Project not found'}
        </div>
      </div>
    );
  }

  if (!project && !loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Projects</span>
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Project not found
        </div>
      </div>
    );
  }

  const budget = formatBudget((project as any).budget);
  const isCompleted = project.end_date && new Date(project.end_date) <= new Date();
  const status = isCompleted ? 'completed' : 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
          <p className="text-gray-600 mt-1">Project Details</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Details */}
        <Card title="Project Information">
          <div className="space-y-4">
            {client && (
              <div className="flex items-start space-x-3">
                <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Client</p>
                  <p className="text-gray-900 font-medium">{client.name}</p>
                </div>
              </div>
            )}
            {project.start_date && (
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Start Date</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(project.start_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}
            {project.end_date && (
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">End Date</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(project.end_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
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
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 font-medium">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(project.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 flex items-center justify-center mt-0.5">
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-gray-900 font-medium capitalize">{status}</p>
              </div>
            </div>
            {project.location && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="text-gray-900 font-medium">{project.location}</p>
                </div>
              </div>
            )}
            {(project as any).description && (
              <div className="pt-2">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900">{(project as any).description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Project Statistics */}
        <Card title="Project Statistics">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Total Workers</p>
              <p className="text-2xl font-bold text-gray-900">
                {assignedWorkers.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Supervisors</p>
              <p className="text-2xl font-bold text-blue-600">
                {assignedSupervisors.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Regular Workers</p>
              <p className="text-2xl font-bold text-green-600">
                {regularWorkers.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Assigned Workers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Assigned Workers ${regularWorkers.length}`}>
          {regularWorkers.length === 0 ? (
            <p className="text-sm text-gray-500">No workers assigned to this project</p>
          ) : (
            <div className="space-y-3">
              {regularWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{worker.name}</p>
                    {worker.email && (
                      <p className="text-sm text-gray-600">{worker.email}</p>
                    )}
                    {worker.phone && (
                      <p className="text-sm text-gray-600">{worker.phone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Assigned Supervisors */}
        <Card title={`Assigned Supervisors (${assignedSupervisors.length})`}>
          {assignedSupervisors.length === 0 ? (
            <div className="text-center py-8">
              <UserCog className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500">No supervisors assigned to this project</p>
              <p className="text-xs text-gray-400 mt-2">
                Use the API endpoint or SQL script to assign supervisors
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedSupervisors.map((supervisor: any) => (
                <div
                  key={supervisor.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <UserCog className="h-4 w-4 text-blue-600" />
                      <p className="font-medium text-gray-900">{supervisor.name}</p>
                    </div>
                    {supervisor.email && (
                      <p className="text-sm text-gray-600 flex items-center space-x-1">
                        <span>📧</span>
                        <span>{supervisor.email}</span>
                      </p>
                    )}
                    {supervisor.phone && (
                      <p className="text-sm text-gray-600 flex items-center space-x-1">
                        <span>📞</span>
                        <span>{supervisor.phone}</span>
                      </p>
                    )}
                    {supervisor.assignedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned: {new Date(supervisor.assignedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

