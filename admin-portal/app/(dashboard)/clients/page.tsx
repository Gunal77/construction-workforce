'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ChevronLeft, ChevronRight, UserSquare2, X } from 'lucide-react';
import ClientCard from '@/components/ClientCard';
import ClientForm from '@/components/ClientForm';
import Input from '@/components/Input';
import Select from '@/components/Select';
import { createClient as createClientAction, updateClient as updateClientAction, ClientData } from '@/app/actions/clientActions';

type Client = ClientData;

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingClientId, setTogglingClientId] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 9,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  
  // Filters (for API calls)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Separate input state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  useEffect(() => {
    fetchClients();
  }, [currentPage, statusFilter, sortBy, sortOrder, searchQuery]); // Re-fetch when these change

  const fetchClients = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active' ? 'true' : 'false');
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      
      const queryString = params.toString();
      const url = `/api/proxy/clients${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Failed to fetch clients',
          message: 'Unknown error'
        }));
        throw new Error(errorData.error || errorData.message || 'Failed to fetch clients');
      }

      const data = await response.json();
      
      if (data.success) {
        setClients(data.data || []);
        // Calculate pagination from backend response
        const total = data.count || data.data?.length || 0;
        const totalPages = Math.ceil(total / 9);
        setPagination({
          page: currentPage,
          limit: 9,
          total: total,
          totalPages: totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        });
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch clients');
      }
    } catch (error: any) {
      console.error('Error fetching clients:', error);
      const errorMessage = error.message || 'Failed to fetch clients. Please check if the backend server is running.';
      alert(errorMessage);
      // Set empty state on error
      setClients([]);
      setPagination({
        page: 1,
        limit: 9,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput); // Set search query when button clicked
    setCurrentPage(1); // Reset to first page
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as 'all' | 'active' | 'inactive');
    setCurrentPage(1); // Reset to first page
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setCurrentPage(1); // Reset to first page
  };

  const handleSortOrderChange = (value: string) => {
    setSortOrder(value as 'ASC' | 'DESC');
    setCurrentPage(1); // Reset to first page
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddClient = () => {
    setSelectedClient(undefined);
    setShowForm(true);
  };

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowForm(true);
  };

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      
      let result;
      if (selectedClient) {
        result = await updateClientAction(selectedClient.id, data);
      } else {
        result = await createClientAction(data);
      }
      
      if (result.success) {
        alert(result.message || 'Client saved successfully');
        setShowForm(false);
        setSelectedClient(undefined);
        fetchClients();
      } else {
        alert(result.error || 'Failed to save client');
      }
    } catch (error: any) {
      console.error('Error saving client:', error);
      alert('Failed to save client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (clientId: string, currentStatus: boolean) => {
    // Ensure we have a proper boolean
    const currentStatusBool = currentStatus === true;
    const newStatus = !currentStatusBool;
    const statusText = newStatus ? 'active' : 'inactive';
    
    if (!confirm(`Are you sure you want to make this client ${statusText}?`)) {
      return;
    }

    try {
      setTogglingClientId(clientId);
      console.log(`[TOGGLE] Client ${clientId}: ${currentStatusBool} -> ${newStatus}`);
      const result = await updateClientAction(clientId, { is_active: newStatus });
      
      if (result.success) {
        console.log(`[TOGGLE] Success! Updated status to: ${result.data?.is_active}`);
        // Refresh the current page to get updated data
        fetchClients();
      } else {
        console.error(`[TOGGLE] Failed:`, result.error);
        alert(result.error || 'Failed to update client status');
      }
    } catch (error: any) {
      console.error('Error toggling status:', error);
      alert('Failed to update client status');
    } finally {
      setTogglingClientId(null);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setSelectedClient(undefined);
  };

  // Calculate stats from current page data (approximate)
  const stats = {
    total: pagination.total,
    active: clients.filter((c) => c.is_active === true).length,
    inactive: clients.filter((c) => c.is_active === false).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">
            Manage your clients and their associated resources
          </p>
        </div>
        <button
          onClick={handleAddClient}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Clients</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <UserSquare2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Clients</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <UserSquare2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactive Clients</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">{stats.inactive}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <UserSquare2 className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search className="h-5 w-5" />
              <span>Search</span>
            </button>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                title="Clear search and show all clients"
              >
                <X className="h-5 w-5" />
                <span>Clear</span>
              </button>
            )}
          </div>
          
          <Select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />

          <Select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            options={[
              { value: 'created_at', label: 'Sort by: Date' },
              { value: 'name', label: 'Sort by: Name' },
              { value: 'email', label: 'Sort by: Email' },
            ]}
          />

          <Select
            value={sortOrder}
            onChange={(e) => handleSortOrderChange(e.target.value)}
            options={[
              { value: 'DESC', label: 'Descending' },
              { value: 'ASC', label: 'Ascending' },
            ]}
          />
        </div>
      </div>

      {/* Clients Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary-600"></div>
          <p className="text-gray-600 mt-4">Loading clients...</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <UserSquare2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Get started by adding your first client'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={handleAddClient}
              className="inline-flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Add Client</span>
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <ClientCard 
                key={client.id} 
                client={client}
                onToggleStatus={handleToggleStatus}
                isToggling={togglingClientId === client.id}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium">{(currentPage - 1) * 9 + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * 9, pagination.total)}
                </span>{' '}
                of <span className="font-medium">{pagination.total}</span> clients
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={!pagination.hasPrevPage || loading}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        disabled={loading}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={!pagination.hasNextPage || loading}
                  className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Client Form Modal */}
      {showForm && (
        <ClientForm
          client={selectedClient}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

