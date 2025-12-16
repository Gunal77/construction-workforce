import Link from 'next/link';
import { Building2, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Project Workforce Management
          </h1>
          <p className="text-gray-600">Choose your login portal</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/login"
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all group"
          >
            <div className="h-16 w-16 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-200 transition-colors">
              <Shield className="h-8 w-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Portal</h3>
            <p className="text-sm text-gray-600 text-center">
              Manage projects, clients, and workforce
            </p>
          </Link>

          <Link
            href="/client-login"
            className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all group"
          >
            <div className="h-16 w-16 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Client Portal</h3>
            <p className="text-sm text-gray-600 text-center">
              View and track your projects
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

