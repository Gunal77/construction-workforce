'use client';

import { useState, useEffect } from 'react';
import { Building2, Calendar, DollarSign, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalBudget: 0,
  });
  const [clientInfo, setClientInfo] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch client info
      const clientResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      
      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        setClientInfo(clientData.data);
      }

      // Fetch projects stats
      const projectsResponse = await fetch('/api/proxy/client/projects/stats', {
        credentials: 'include',
      });

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setStats(projectsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {clientInfo?.name || 'Client'}!
        </h1>
        <p className="text-primary-100">
          Here's an overview of your projects and activities
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalProjects}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {stats.activeProjects}
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-600 mt-1">
                {stats.completedProjects}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Building2 className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-primary-600 mt-1">
                {formatCurrency(stats.totalBudget)}
              </p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/client/projects')}
            className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          >
            <Building2 className="h-6 w-6 text-primary-600" />
            <div>
              <p className="font-medium text-gray-900">View All Projects</p>
              <p className="text-sm text-gray-500">See all your projects</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

