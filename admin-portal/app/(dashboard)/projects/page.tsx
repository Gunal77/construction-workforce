'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { projectsAPI, Project } from '@/lib/api';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Textarea from '@/components/Textarea';
import ProjectCard from '@/components/ProjectCard';
import SearchableSelect from '@/components/SearchableSelect';
import Select from '@/components/Select';
import { Plus, Search } from 'lucide-react';
import { getAllClients, ClientData } from '@/app/actions/clientActions';

const ITEMS_PER_PAGE = 9;

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');

  // Form state for add/edit
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    description: '',
    budget: '',
    client_user_id: '',
  });

  // Clients for dropdown
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoadingClients(true);
      const response = await getAllClients();
      if (response.success) {
        setClients(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await projectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await projectsAPI.create({
        name: formData.name,
        location: formData.location || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        description: formData.description || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        client_user_id: formData.client_user_id || undefined,
      });
      setIsAddModalOpen(false);
      setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create project');
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setError('');

    try {
      await projectsAPI.update(selectedProject.id, {
        name: formData.name,
        location: formData.location || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        description: formData.description || undefined,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
        client_user_id: formData.client_user_id || undefined,
      });
      setIsEditModalOpen(false);
      setSelectedProject(null);
      setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update project');
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      await projectsAPI.delete(selectedProject.id);
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      location: project.location || '',
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : '',
      description: (project as any).description || '',
      budget: (project as any).budget ? String((project as any).budget) : '',
      client_user_id: (project as any).client_user_id || '',
    });
    setIsEditModalOpen(true);
  };

  const handleViewProject = (project: Project) => {
    router.push(`/projects/${project.id}`);
  };

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;

    // Apply project filter
    if (selectedProjectFilter) {
      filtered = filtered.filter((project) => project.id === selectedProjectFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (project) =>
          project.name?.toLowerCase().includes(query) ||
          project.location?.toLowerCase().includes(query) ||
          (project as any).description?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((project) => {
        if (statusFilter === 'active') {
          return !project.end_date || new Date(project.end_date) > new Date();
        } else if (statusFilter === 'completed') {
          return project.end_date && new Date(project.end_date) <= new Date();
        }
        return true;
      });
    }

    // Apply client filter
    if (clientFilter) {
      filtered = filtered.filter((project) => {
        return (project as any).client_user_id === clientFilter;
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '');
      }
      return 0;
    });

    return sorted;
  }, [projects, searchQuery, statusFilter, selectedProjectFilter, clientFilter, sortBy]);

  // Paginate
  const paginatedProjects = filteredAndSortedProjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedProjects.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your construction projects</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>New Project</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 w-full">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, description, or location..."
              className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
          </div>
        </div>
        <div className="w-full sm:w-auto min-w-[200px]">
          <SearchableSelect
            options={[
              { value: '', label: 'All Projects' },
              ...projects.map((project) => ({
                value: project.id,
                label: project.name,
              })),
            ]}
            value={selectedProjectFilter}
            onChange={(value) => {
              setSelectedProjectFilter(value);
              setCurrentPage(1);
            }}
            placeholder="Filter by project"
            searchPlaceholder="Search projects..."
          />
        </div>
        <div className="w-full sm:w-auto min-w-[150px]">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="w-full sm:w-auto min-w-[200px]">
          <SearchableSelect
            options={[
              { value: '', label: 'All Clients' },
              ...clients
                .filter((c) => c.is_active !== false)
                .map((client) => ({
                  value: client.id,
                  label: client.name,
                })),
            ]}
            value={clientFilter}
            onChange={(value) => {
              setClientFilter(value);
              setCurrentPage(1);
            }}
            placeholder="Filter by client"
            searchPlaceholder="Search clients..."
          />
        </div>
        <div className="w-full sm:w-auto min-w-[150px]">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Pagination Info */}
      {filteredAndSortedProjects.length > 0 && (
        <p className="text-sm text-gray-600">
          Showing {startIndex} - {endIndex} of {filteredAndSortedProjects.length} projects
        </p>
      )}

      {/* Projects Grid */}
      {paginatedProjects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProjects.map((project) => {
            const clientId = (project as any).client_user_id;
            const client = clients.find((c) => c.id === clientId);
            return (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleViewProject(project)}
                clientName={client?.name}
              />
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Add Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
          setError('');
        }}
        title="Add New Project"
        size="lg"
      >
        <form onSubmit={handleAddProject} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <Input
            label="Project Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter project name"
          />

          <div>
            <SearchableSelect
              label="Client"
              value={formData.client_user_id}
              onChange={(value) => setFormData({ ...formData, client_user_id: value })}
              placeholder="Select a client..."
              searchPlaceholder="Search clients..."
              options={loadingClients ? [] : clients
                .filter((c) => c.is_active !== false)
                .map((client) => ({
                  value: client.id,
                  label: client.name,
                }))}
            />
            {loadingClients && (
              <p className="text-sm text-gray-500 mt-1">Loading clients...</p>
            )}
            {!formData.client_user_id && (
              <p className="text-sm text-red-500 mt-1">Client is required</p>
            )}
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter project description"
            rows={3}
          />

          <Input
            label="Location"
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Enter project location"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <Input
            label="Budget (SGD)"
            type="number"
            step="0.01"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            placeholder="0.00"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Project
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProject(null);
          setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
          setError('');
        }}
        title="Edit Project"
        size="lg"
      >
        <form onSubmit={handleEditProject} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <Input
            label="Project Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Enter project name"
          />

          <div>
            <SearchableSelect
              label="Client"
              value={formData.client_user_id}
              onChange={(value) => setFormData({ ...formData, client_user_id: value })}
              placeholder="Select a client..."
              searchPlaceholder="Search clients..."
              options={loadingClients ? [] : clients
                .filter((c) => c.is_active !== false)
                .map((client) => ({
                  value: client.id,
                  label: client.name,
                }))}
            />
            {loadingClients && (
              <p className="text-sm text-gray-500 mt-1">Loading clients...</p>
            )}
            {!formData.client_user_id && (
              <p className="text-sm text-red-500 mt-1">Client is required</p>
            )}
          </div>

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter project description"
            rows={3}
          />

          <Input
            label="Location"
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Enter project location"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <Input
            label="Budget (SGD)"
            type="number"
            step="0.01"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            placeholder="0.00"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedProject(null);
                setFormData({ name: '', location: '', start_date: '', end_date: '', description: '', budget: '', client_user_id: '' });
                setError('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Update Project
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedProject(null);
        }}
        title="Delete Project"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete{' '}
            <span className="font-semibold">{selectedProject?.name}</span>? This
            action cannot be undone.
          </p>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedProject(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteProject}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
