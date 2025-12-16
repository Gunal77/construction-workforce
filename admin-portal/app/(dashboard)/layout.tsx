import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-0 lg:ml-64 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 mt-16 bg-gray-50 max-w-full">
          <div className="w-full max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

