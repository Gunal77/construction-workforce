'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  Calendar,
  FolderKanban,
  UserCheck,
  Users,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { getClientById, getClientStats, updateClient as updateClientAction, deleteClient as deleteClientAction } from '@/app/actions/clientActions';
import ClientForm from '@/components/ClientForm';
import StatCard from '@/components/StatCard';

type Client = any;
type ClientStats = any;

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    fetchClientData();
  }, [params.id]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const [clientResponse, statsResponse] = await Promise.all([
        getClientById(params.id),
        getClientStats(params.id),
      ]);
      
      if (clientResponse.success && statsResponse.success) {
        setClient(clientResponse.data);
        setStats(statsResponse.data);
      } else {
        alert(clientResponse.error || statsResponse.error || 'Failed to fetch client data');
        router.push('/clients');
      }
    } catch (error: any) {
      console.error('Error fetching client data:', error);
      alert('Failed to fetch client data');
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      setIsSubmitting(true);
      const result = await updateClientAction(params.id, data);
      
      if (result.success) {
        alert(result.message || 'Client updated successfully');
        setShowEditForm(false);
        fetchClientData();
      } else {
        alert(result.error || 'Failed to update client');
      }
    } catch (error: any) {
      console.error('Error updating client:', error);
      alert('Failed to update client');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await deleteClientAction(params.id);
      
      if (result.success) {
        alert(result.message || 'Client deleted successfully');
        router.push('/clients');
      } else {
        alert(result.error || 'Failed to delete client');
      }
    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client');
    }
  };

  const handleToggleStatus = async () => {
    if (!client) return;
    
    const newStatus = !client.is_active;
    const statusText = newStatus ? 'active' : 'inactive';
    
    if (!confirm(`Are you sure you want to make this client ${statusText}?`)) {
      return;
    }

    try {
      setIsTogglingStatus(true);
      const result = await updateClientAction(params.id, { is_active: newStatus });
      
      if (result.success) {
        alert(`Client is now ${statusText}`);
        fetchClientData(); // Refresh data
      } else {
        alert(result.error || 'Failed to update client status');
      }
    } catch (error: any) {
      console.error('Error toggling status:', error);
      alert('Failed to update client status');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary-600"></div>
          <p className="text-gray-600 mt-4">Loading client details...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
          <button
            onClick={() => router.push('/clients')}
            className="text-primary-600 hover:text-primary-700"
          >
            Go back to clients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/clients')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
              {client.is_active !== false ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">Client Details</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowEditForm(true)}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-4 py-2 border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Client Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{client.email || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-50 rounded">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="text-sm font-medium text-gray-900">{client.phone || 'Not provided'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 rounded">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-sm font-medium text-gray-900">
                {client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-50 rounded">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Status</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm font-medium">
                  {client.is_active !== false ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </p>
                {/* Toggle Switch */}
                <button
                  onClick={handleToggleStatus}
                  disabled={isTogglingStatus}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                    client.is_active !== false ? 'bg-green-500' : 'bg-gray-300'
                  } ${isTogglingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={`Click to make client ${client.is_active !== false ? 'inactive' : 'active'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      client.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                {isTogglingStatus && (
                  <span className="text-xs text-gray-500">Updating...</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Projects"
          value={stats?.projects?.total || 0}
          icon={<FolderKanban className="h-6 w-6" />}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Projects"
          value={stats?.projects?.active || 0}
          icon={<Building2 className="h-6 w-6" />}
          iconBgColor="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          title="Supervisors"
          value={stats?.supervisors || 0}
          icon={<UserCheck className="h-6 w-6" />}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Total Staff"
          value={stats?.staff?.total || 0}
          icon={<Users className="h-6 w-6" />}
          iconBgColor="bg-orange-50"
          iconColor="text-orange-600"
        />
      </div>

      {/* Projects Section - Coming Soon */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects</h2>
        {client.projects && client.projects.length > 0 ? (
          <div className="space-y-3">
            {client.projects.map((project: any) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 rounded">
                    <FolderKanban className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    {project.location && (
                      <p className="text-sm text-gray-500">{project.location}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No projects assigned yet</p>
        )}
      </div>

      {/* Supervisors Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Supervisors</h2>
        {client.supervisors && client.supervisors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {client.supervisors.map((supervisor: any) => (
              <div
                key={supervisor.id}
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg"
              >
                <div className="p-2 bg-purple-50 rounded">
                  <UserCheck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{supervisor.name}</p>
                  <p className="text-sm text-gray-500">{supervisor.email}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No supervisors assigned yet</p>
        )}
      </div>

      {/* Staff Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Staff</h2>
        {client.staff && client.staff.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {client.staff.map((staff: any) => (
              <div
                key={staff.id}
                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/workers/${staff.id}`)}
              >
                <div className="p-2 bg-orange-50 rounded">
                  <Users className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{staff.name}</p>
                  <p className="text-sm text-gray-500">{staff.role || 'Staff'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No staff assigned yet</p>
        )}
      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <ClientForm
          client={client}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditForm(false)}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}

