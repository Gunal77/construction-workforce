'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Building2, Clock, Eye, EyeOff, Server } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Gradient Background */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-500 via-green-400 to-green-50 items-center justify-center p-12">
        <div className="max-w-md w-full space-y-8">
          {/* Server/Building Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="h-24 w-24 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <Server className="h-12 w-12 text-white" />
              </div>
              {/* Yellow lights indicator */}
              <div className="absolute -bottom-2 -right-2 flex space-x-1">
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
                <div className="h-3 w-3 bg-yellow-400 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Project Progress */}
          <div className="bg-white/30 backdrop-blur-sm rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-800 font-semibold">Project Progress</span>
              <span className="text-gray-800 font-bold">85%</span>
            </div>
            <div className="w-full bg-white/50 rounded-full h-3">
              <div className="bg-blue-600 h-3 rounded-full" style={{ width: '85%' }}></div>
            </div>
          </div>

          {/* Feature Icons */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Staffs</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-green-100 rounded-lg flex items-center justify-center">
                <Building2 className="h-8 w-8 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Projects</span>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="h-16 w-16 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">Tracking</span>
            </div>
          </div>

          {/* Title and Subtitle */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Workforce Management</h1>
            <p className="text-lg text-gray-700">
              Manage your construction projects with precision and efficiency
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md space-y-8">
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
                  console.error('Logo image failed to load from /images/logo.png');
                }}
              />
            </div>
            <p className="text-sm text-gray-600 mb-6">Project Workforce Management Platform</p>
            <h2 className="text-2xl font-semibold text-gray-800">Sign in to your account</h2>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Switch to Client Login */}
          <div className="text-center">
            <Link
              href="/client-login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Are you a client? Sign in here →
            </Link>
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
