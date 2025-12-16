'use client';

import { Project } from '@/lib/api';
import { MapPin, Calendar, DollarSign, Building2, Users, UserCheck, Eye, Edit, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  clientName?: string;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}

export default function ProjectCard({ 
  project, 
  onClick, 
  clientName, 
  onEdit, 
  onArchive,
  onDelete,
  isAdmin = true 
}: ProjectCardProps) {
  // Determine status
  const isCompleted = project.end_date && new Date(project.end_date) <= new Date();
  const isOverdue = project.end_date && new Date(project.end_date) < new Date() && !isCompleted;
  const status = isCompleted ? 'completed' : (project.status === 'on_hold' || project.status === 'ON HOLD' ? 'on_hold' : 'active');

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

  const budget = formatBudget(project.budget);
  const staffCount = project.staff_count || 0;
  const supervisorName = project.supervisor_name || null;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-6 hover:border-primary-300 hover:shadow-md transition-all relative"
    >
      {/* Project Name, Status, and Action Icons */}
      <div className="flex items-start justify-between mb-3">
        <h3 
          className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-primary-600 transition-colors flex-1"
          onClick={onClick}
        >
          {project.name}
        </h3>
        <div className="flex items-center gap-2 ml-2">
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
          
          {/* Action Icons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-transparent hover:border-primary-200"
              title="View Project"
            >
              <Eye className="h-4 w-4" />
            </button>
            {isAdmin && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                title="Edit Project"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {isAdmin && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                title="Delete Project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client Name (Mandatory) */}
      <div className="mb-3">
        <div className="flex items-start space-x-2 text-sm">
          <Building2 className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-gray-500">Client: </span>
            <span className="font-medium text-gray-900">
              {clientName || project.client_name || 'No Client Assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="space-y-2">
        {/* Location */}
        {project.location && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>{project.location}</span>
          </div>
        )}

        {/* Start Date - End Date */}
        {(project.start_date || project.end_date) && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>
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
            </span>
          </div>
        )}

        {/* Budget */}
        {budget && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="font-medium">Budget: {budget}</span>
          </div>
        )}

        {/* Staff Count */}
        <div className="flex items-start space-x-2 text-sm text-gray-600">
          <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <span className="font-medium">{staffCount} Staff{staffCount !== 1 ? 's' : ''} Assigned</span>
        </div>

        {/* Supervisor */}
        {supervisorName && (
          <div className="flex items-start space-x-2 text-sm text-gray-600">
            <UserCheck className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>
              <span className="text-gray-500">Supervisor: </span>
              <span className="font-medium">{supervisorName}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

