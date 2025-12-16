'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, Clock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';

export default function ClientSignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    contactPerson: '',
    address: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
  });

  const validatePassword = (password: string) => {
    setPasswordValidation({
      minLength: password.length >= 8 && password.length <= 128,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*]/.test(password),
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData({ ...formData, password });
    validatePassword(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }

    if (!passwordValidation.minLength || !passwordValidation.hasUpper || 
        !passwordValidation.hasLower || !passwordValidation.hasNumber || 
        !passwordValidation.hasSpecial) {
      setError('Password does not meet all requirements');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.phone.trim()) {
      const phoneRegex = /^[0-9\s\-\+\(\)]{8,13}$/;
      const digitsOnly = formData.phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(formData.phone) || digitsOnly.length < 8 || digitsOnly.length > 13) {
        setError('Phone number must be 8-13 digits (Singapore: 8 digits)');
        return;
      }
    }

    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/client-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          password: formData.password,
          companyName: formData.companyName.trim(),
          contactPerson: formData.contactPerson.trim() || formData.name.trim(),
          address: formData.address.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Signup failed');
        setLoading(false);
        return;
      }

      // Redirect to login page with success message
      router.push('/client-login?signup=success');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-500 via-blue-400 to-blue-50 items-center justify-center p-12">
        <div className="max-w-md w-full space-y-8">
          {/* Building Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="h-24 w-24 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <Building2 className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 flex space-x-1">
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Feature Icons */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Projects</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Team</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Progress</span>
            </div>
          </div>

          {/* Title and Subtitle */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Join Client Portal</h1>
            <p className="text-lg text-gray-700">
              Register to access and manage your construction projects
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Logo */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/logo.png" 
                alt="Logo" 
                className="h-20 w-20 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mb-6">Project Workforce Management Platform</p>
            <h2 className="text-2xl font-semibold text-gray-800">Create Client Account</h2>
            <p className="text-sm text-gray-500 mt-2">Sign up to get started</p>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="John Smith"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="client@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="+65 91234567"
              />
              <p className="text-xs text-gray-500 mt-1">8-13 digits (Singapore: 8 digits)</p>
            </div>

            {/* Company Name */}
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="ABC Construction Pte Ltd"
              />
            </div>

            {/* Contact Person */}
            <div>
              <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-2">
                Contact Person
              </label>
              <input
                id="contactPerson"
                type="text"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="John Smith (defaults to your name)"
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Company Address
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="123 Construction Street, Singapore 123456"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className={`flex items-center ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.minLength ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    At least 8 characters (max 128)
                  </div>
                  <div className={`flex items-center ${passwordValidation.hasUpper ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasUpper ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    One uppercase letter
                  </div>
                  <div className={`flex items-center ${passwordValidation.hasLower ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasLower ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    One lowercase letter
                  </div>
                  <div className={`flex items-center ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasNumber ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    One number
                  </div>
                  <div className={`flex items-center ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-gray-500'}`}>
                    {passwordValidation.hasSpecial ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    One special character (!@#$%^&*)
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link href="/client-login" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign in here →
              </Link>
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-500 mt-4">
            © 2024 Project Workforce Admin. Enterprise Edition.
          </div>
        </div>
      </div>
    </div>
  );
}

