'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Calendar, DollarSign } from 'lucide-react';
import Card from '@/components/Card';

export default function ClientProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all projects and filter by client
      const response = await fetch('/api/proxy/client/projects', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      const projects = data.projects || [];
      const foundProject = projects.find((p: any) => p.id === projectId);

      if (foundProject) {
        setProject(foundProject);
      } else {
        setError('Project not found or access denied');
      }
    } catch (err: any) {
      console.error('Error fetching project:', err);
      setError(err.message || 'Failed to fetch project details');
    } finally {
      setLoading(false);
    }
  };

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
          onClick={() => router.push('/client/projects')}
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
          onClick={() => router.push('/client/projects')}
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

  const budget = formatBudget(project.budget);
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
            {project.description && (
              <div className="pt-2">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900">{project.description}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Project Timeline */}
        <Card title="Project Timeline">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-gray-900 font-medium">
                {new Date(project.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            {project.start_date && project.end_date && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Duration</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Start</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(project.start_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">End</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(project.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

