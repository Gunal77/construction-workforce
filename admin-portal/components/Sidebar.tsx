'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  FolderKanban,
  FileText,
  Calendar,
  LogOut,
  Timer,
  Menu,
  X,
  UserSquare2,
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: UserSquare2 },
  { href: '/workers', label: 'Staffs', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/timesheets', label: 'Timesheets', icon: Timer },
  { href: '/leave', label: 'Leave Management', icon: Calendar },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (response.ok) {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <X className="h-6 w-6 text-gray-700" />
        ) : (
          <Menu className="h-6 w-6 text-gray-700" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm z-50 overflow-y-auto transform transition-transform duration-300 ease-in-out ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex h-full flex-col">
        <div className="flex h-16 items-center space-x-3 border-b border-gray-200 px-4">
          <img 
            src="/images/logo.png" 
            alt="Logo" 
            className="h-10 w-10 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              console.error('Logo image failed to load from /images/logo.png');
            }}
          />
          <div>
            <h1 className="text-sm font-bold text-gray-900">Construction Workforce</h1>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 rounded-lg px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4 mt-auto">
          <div className="flex items-center space-x-3 px-4 py-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center">
              <span className="text-white text-sm font-medium">A</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center space-x-3 rounded-lg px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

