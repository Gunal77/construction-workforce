'use client';

import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import Input from './Input';
import { Client } from '@/lib/api';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
    is_active?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ClientForm({ client, onSubmit, onCancel, isLoading }: ClientFormProps) {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    password: '',
    is_active: client?.is_active ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Client name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Email validation - comprehensive
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const email = formData.email.trim();
      // RFC 5322 compliant email regex (simplified)
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!emailRegex.test(email)) {
        newErrors.email = 'Invalid email format';
      } else if (email.length > 254) {
        newErrors.email = 'Email is too long';
      } else if (!email.includes('.')) {
        newErrors.email = 'Email must contain a domain';
      }
    }

    // Password validation - strong security rules
    if (!client && !formData.password.trim()) {
      newErrors.password = 'Password is required for new clients';
    } else if (formData.password) {
      const password = formData.password;
      const errors = [];

      if (password.length < 8) {
        errors.push('at least 8 characters');
      }
      if (!/[A-Z]/.test(password)) {
        errors.push('one uppercase letter');
      }
      if (!/[a-z]/.test(password)) {
        errors.push('one lowercase letter');
      }
      if (!/[0-9]/.test(password)) {
        errors.push('one number');
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('one special character');
      }
      if (password.length > 128) {
        errors.push('maximum 128 characters');
      }

      if (errors.length > 0) {
        newErrors.password = `Password must contain ${errors.join(', ')}`;
      }
    }

    // Phone validation (optional but if provided, validate)
    // Singapore: 8 digits, International: 8-13 digits
    if (formData.phone && formData.phone.trim()) {
      const phone = formData.phone.trim();
      // Allow only digits, spaces, +, -, (, )
      if (!/^[\d\s+\-()]+$/.test(phone)) {
        newErrors.phone = 'Invalid phone number format';
      } else {
        const digitCount = phone.replace(/[\s+\-()]/g, '').length;
        if (digitCount < 8 || digitCount > 13) {
          newErrors.phone = 'Phone number must be 8-13 digits (Singapore: 8 digits)';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const submitData: any = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim() || undefined,
      is_active: formData.is_active,
    };

    if (formData.password.trim()) {
      submitData.password = formData.password;
    }

    await onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {client ? 'Edit Client' : 'Add New Client'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Input
              label="Client Name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter client name"
              error={errors.name}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="client@example.com"
              error={errors.email}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+65 1234 5678"
              error={errors.phone}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {client ? 'Password (leave blank to keep current)' : 'Password'}
              {!client && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter secure password"
                disabled={isLoading}
                required={!client}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                } ${isLoading ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password}</p>
            )}
            {!client && !errors.password && (
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <p className="font-medium">Password must contain:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li className={formData.password.length >= 8 ? 'text-green-600' : ''}>
                    At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}>
                    One uppercase letter (A-Z)
                  </li>
                  <li className={/[a-z]/.test(formData.password) ? 'text-green-600' : ''}>
                    One lowercase letter (a-z)
                  </li>
                  <li className={/[0-9]/.test(formData.password) ? 'text-green-600' : ''}>
                    One number (0-9)
                  </li>
                  <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'text-green-600' : ''}>
                    One special character (!@#$%^&*)
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="is_active" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Status
                </label>
                <p className="text-xs text-gray-500">
                  {client ? 'Active clients can login and access the portal' : 'Client will be created as Active by default'}
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="is_active" className="ml-2 block text-sm font-medium text-gray-900">
                  {formData.is_active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </label>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

