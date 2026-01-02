'use client';

import Link from 'next/link';
import { Users, FolderKanban, UserCheck, Mail, Phone, ChevronRight } from 'lucide-react';
import { Client } from '@/lib/api';

interface ClientCardProps {
  client: Client;
  onToggleStatus?: (clientId: string, currentStatus: boolean) => void;
  isToggling?: boolean;
}

export default function ClientCard({ client, onToggleStatus, isToggling = false }: ClientCardProps) {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleStatus && !isToggling) {
      // Ensure we pass a proper boolean
      const currentStatus = client.is_active === true;
      onToggleStatus(client.id, currentStatus);
    }
  };

  return (
    <Link
      href={`/clients/${client.id}`}
      className="block bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
            {client.is_active === true ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                Inactive
              </span>
            )}
            {/* Toggle Switch */}
            {onToggleStatus && (
              <button
                onClick={handleToggleClick}
                disabled={isToggling}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ml-2 ${
                  client.is_active === true ? 'bg-green-500' : 'bg-gray-300'
                } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                title={`Click to make client ${client.is_active === true ? 'inactive' : 'active'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    client.is_active === true ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="h-4 w-4 mr-2" />
              {client.email}
            </div>
            {client.phone && (
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="h-4 w-4 mr-2" />
                {client.phone}
              </div>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-blue-50 rounded">
            <FolderKanban className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Projects</p>
            <p className="text-sm font-semibold text-gray-900">
              {client.project_count || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="p-2 bg-green-50 rounded">
            <UserCheck className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Supervisors</p>
            <p className="text-sm font-semibold text-gray-900">
              {client.supervisor_count || 0}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="p-2 bg-purple-50 rounded">
            <Users className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Staff</p>
            <p className="text-sm font-semibold text-gray-900">
              {client.staff_count || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Created {new Date(client.created_at).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}

