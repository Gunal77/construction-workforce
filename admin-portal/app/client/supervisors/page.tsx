'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, MapPin, Building2, Mail, Phone, Search, X, UserCheck } from 'lucide-react';

interface Supervisor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  project_id?: string;
  project_name?: string;
  project_location?: string;
  assigned_at?: string;
  created_at?: string;
}

export default function ClientSupervisorsPage() {
  const router = useRouter();
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const fetchSupervisors = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/proxy/client/supervisors', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch supervisors');
      }

      const data = await response.json();
      setSupervisors(data.supervisors || []);
    } catch (err: any) {
      console.error('Error fetching supervisors:', err);
      setError(err.message || 'Failed to load supervisors');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const filteredSupervisors = supervisors.filter((supervisor) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      supervisor.name?.toLowerCase().includes(query) ||
      supervisor.email?.toLowerCase().includes(query) ||
      supervisor.project_name?.toLowerCase().includes(query)
    );
  });

  // Group supervisors by project
  const supervisorsByProject = filteredSupervisors.reduce((acc, supervisor) => {
    const projectName = supervisor.project_name || 'Unassigned';
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(supervisor);
    return acc;
  }, {} as Record<string, Supervisor[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading supervisors...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supervisors</h1>
        <p className="text-gray-600 mt-1">View all supervisors assigned to your projects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Supervisors</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {new Set(supervisors.map(s => s.id)).size}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <UserCheck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {Object.keys(supervisorsByProject).filter(p => p !== 'Unassigned').length}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Building2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Filtered Results</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredSupervisors.length}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <Search className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name, email, or project..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <X className="h-5 w-5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Supervisors List by Project */}
      {filteredSupervisors.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">
            {searchQuery ? 'No supervisors found matching your search' : 'No supervisors assigned to your projects'}
          </p>
          {!searchQuery && (
            <p className="text-gray-400 text-sm mt-2">
              Supervisors will appear here once they are assigned to your projects
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(supervisorsByProject).map(([projectName, projectSupervisors]) => (
            <div key={projectName} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Building2 className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">{projectName}</h2>
                <span className="text-sm text-gray-500">
                  ({projectSupervisors.length} supervisor{projectSupervisors.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projectSupervisors.map((supervisor) => (
                  <div
                    key={`${supervisor.id}-${supervisor.project_id || 'unassigned'}`}
                    className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{supervisor.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Supervisor</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {supervisor.email && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{supervisor.email}</span>
                        </div>
                      )}
                      {supervisor.phone && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{supervisor.phone}</span>
                        </div>
                      )}
                      {supervisor.project_location && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{supervisor.project_location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

