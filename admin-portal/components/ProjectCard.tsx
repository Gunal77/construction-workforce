'use client';

import { Project } from '@/lib/api';
import { MapPin, Calendar, DollarSign, Building2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  clientName?: string;
}

export default function ProjectCard({ project, onClick, clientName }: ProjectCardProps) {
  // Determine status
  const isCompleted = project.end_date && new Date(project.end_date) <= new Date();
  const status = isCompleted ? 'completed' : 'active';

  // Format budget if available
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

  const budget = formatBudget((project as any).budget);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
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

      {(project as any).description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {(project as any).description}
        </p>
      )}

      <div className="space-y-2">
        {clientName && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="font-medium text-gray-700">Client: {clientName}</span>
          </div>
        )}
        {project.location && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>{project.location}</span>
          </div>
        )}

        {(project.start_date || project.end_date) && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'N/A'}{' '}
              -{' '}
              {project.end_date
                ? new Date(project.end_date).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Ongoing'}
            </span>
          </div>
        )}

        {budget && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="font-medium">Budget: {budget}</span>
          </div>
        )}
      </div>
    </div>
  );
}

