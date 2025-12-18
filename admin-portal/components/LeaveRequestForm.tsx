'use client';

import { useState, useEffect } from 'react';
import { leaveAPI, LeaveType, Employee, projectsAPI, employeesAPI } from '@/lib/api';
import Input from './Input';
import Modal from './Modal';
import { Calendar } from 'lucide-react';

interface LeaveRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId?: string;
  employeeName?: string;
  employees?: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

interface Project {
  id: string;
  name: string;
}

export default function LeaveRequestForm({
  isOpen,
  onClose,
  employeeId: initialEmployeeId,
  employeeName: initialEmployeeName,
  employees = [],
  onSuccess,
}: LeaveRequestFormProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employeeProjects, setEmployeeProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [formData, setFormData] = useState({
    leaveTypeId: '',
    projectId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLeaveTypes();
      fetchProjects();
      // Set initial employee if provided
      if (initialEmployeeId) {
        setSelectedEmployeeId(initialEmployeeId);
        fetchEmployeeProjects(initialEmployeeId);
      } else if (employees.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(employees[0].id);
        fetchEmployeeProjects(employees[0].id);
      }
    }
  }, [isOpen, initialEmployeeId, employees]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchEmployeeProjects(selectedEmployeeId);
      // Reset project selection when employee changes
      setFormData(prev => ({ ...prev, projectId: '' }));
    }
  }, [selectedEmployeeId]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await leaveAPI.getTypes();
      // Filter to only show: Annual Leave, Sick Leave, Unpaid Leave
      const simplifiedTypes = (response.leaveTypes || []).filter((type: LeaveType) => 
        ['ANNUAL', 'SICK', 'UNPAID'].includes(type.code?.toUpperCase() || '')
      );
      setLeaveTypes(simplifiedTypes);
    } catch (err: any) {
      console.error('Error fetching leave types:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.projects || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchEmployeeProjects = async (employeeId: string) => {
    try {
      // Try to fetch from the new API endpoint
      try {
        const data = await employeesAPI.getAssignedProjects(employeeId);
        const assignedProjects: Project[] = (data.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }));
        setEmployeeProjects(assignedProjects);
        
        // Auto-select project if employee has only one assigned project
        if (assignedProjects.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: assignedProjects[0].id }));
        }
        return;
      } catch (apiErr) {
        console.log('API endpoint not available, using fallback');
      }
      
      // Fallback: Get from employee's direct project_id and project_employees table
      const employeeRes = await employeesAPI.getById(employeeId);
      const employee = employeeRes.employee;
      
      const assignedProjects: Project[] = [];
      
      // Check direct project_id
      if (employee?.project_id) {
        const project = projects.find(p => p.id === employee.project_id);
        if (project) {
          assignedProjects.push(project);
        }
      }
      
      // Also check if we can get from project_employees via a query
      // For now, we'll use the direct project_id
      setEmployeeProjects(assignedProjects);
      
      if (assignedProjects.length === 1 && !formData.projectId) {
        setFormData(prev => ({ ...prev, projectId: assignedProjects[0].id }));
      }
    } catch (err: any) {
      console.error('Error fetching employee projects:', err);
      setEmployeeProjects([]);
    }
  };

  const calculateWorkingDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (endDate < startDate) return 0;
    
    let days = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Calculate working days when both dates are set
      if (updated.startDate && updated.endDate) {
        const days = calculateWorkingDays(updated.startDate, updated.endDate);
        setCalculatedDays(days);
      } else {
        setCalculatedDays(null);
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.leaveTypeId || !formData.startDate || !formData.endDate) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (calculatedDays === null || calculatedDays <= 0) {
        setError('Invalid date range');
        setLoading(false);
        return;
      }

      if (!selectedEmployeeId) {
        setError('Please select an employee');
        setLoading(false);
        return;
      }

      await leaveAPI.createRequest({
        employeeId: selectedEmployeeId,
        leaveTypeId: formData.leaveTypeId,
        projectId: formData.projectId || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason || undefined,
      });

      // Reset form
      setFormData({
        leaveTypeId: '',
        projectId: '',
        startDate: '',
        endDate: '',
        reason: '',
      });
      setCalculatedDays(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Leave" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employee *
          </label>
          {employees.length > 0 ? (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={initialEmployeeName || 'No employees available'}
              disabled
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Leave Type *
          </label>
          <select
            value={formData.leaveTypeId}
            onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select Leave Type</option>
            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {selectedEmployeeId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project *
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select Project</option>
              {employeeProjects.length > 0 ? (
                employeeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))
              )}
            </select>
            {employeeProjects.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">No assigned project. Select from all projects.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date *
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              required
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {calculatedDays !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <span className="font-medium">Working Days:</span> {calculatedDays} day{calculatedDays !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason (Optional)
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter reason for leave..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !selectedEmployeeId || !formData.leaveTypeId || !formData.projectId || !formData.startDate || !formData.endDate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

