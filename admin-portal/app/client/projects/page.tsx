'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, Calendar, DollarSign, Search, X } from 'lucide-react';
import ProjectCard from '@/components/ProjectCard';
import Pagination from '@/components/Pagination';

interface Project {
  id: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  budget?: number;
  created_at: string;
  staff_count?: number;
  supervisor_name?: string;
  status?: string;
}

const ITEMS_PER_PAGE = 9;

export default function ClientProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProjects, setTotalProjects] = useState(0);
  const [allProjects, setAllProjects] = useState<Project[]>([]); // Store all projects for search

  useEffect(() => {
    fetchProjects();
  }, [currentPage]);

  // Fetch all projects when search is active
  useEffect(() => {
    if (searchQuery) {
      fetchAllProjects();
    }
  }, [searchQuery]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proxy/client/projects?page=${currentPage}&limit=${ITEMS_PER_PAGE}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      setProjects(data.projects || []);
      setTotalPages(data.totalPages || 1);
      setTotalProjects(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllProjects = async () => {
    try {
      // Fetch all projects for search (use a large limit)
      const response = await fetch(`/api/proxy/client/projects?page=1&limit=1000`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAllProjects(data.projects || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch all projects for search:', err);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1); // Reset to first page when clearing
  };

  // Filter projects client-side (after fetching from server)
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    const query = searchQuery.toLowerCase();
    // When searching, filter from allProjects; otherwise use paginated projects
    const sourceProjects = searchQuery ? allProjects : projects;
    return sourceProjects.filter((project) => 
      project.name?.toLowerCase().includes(query) ||
      project.location?.toLowerCase().includes(query) ||
      project.description?.toLowerCase().includes(query)
    );
  }, [projects, allProjects, searchQuery]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-gray-600 mt-1">View and manage your construction projects</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder="Search projects by name, location, or description..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
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
            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <X className="h-5 w-5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading projects...</div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No projects found matching your search' : 'No projects assigned yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/client/projects/${project.id}`)}
                hideClientInfo={true}
                isAdmin={false}
              />
            ))}
          </div>

          {/* Pagination */}
          {!searchQuery && totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}

          {/* Project Count */}
          <p className="text-sm text-gray-600 text-center mt-4">
            {searchQuery ? (
              <>Showing {filteredProjects.length} matching project{filteredProjects.length !== 1 ? 's' : ''}</>
            ) : (
              <>Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalProjects)} of {totalProjects} project{totalProjects !== 1 ? 's' : ''}</>
            )}
          </p>
        </>
      )}
    </div>
  );
}

