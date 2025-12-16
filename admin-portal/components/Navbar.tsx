'use client';

export default function Navbar() {
  return (
    <nav className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white border-b border-gray-200 z-40">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          {/* Search bar can be added here if needed */}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">Action required:</div>
          <div className="text-sm text-gray-600">All Bookmarks</div>
        </div>
      </div>
    </nav>
  );
}

