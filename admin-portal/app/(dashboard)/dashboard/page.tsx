import { serverAPI } from '@/lib/api-server';
import StatCard from '@/components/StatCard';
import Card from '@/components/Card';
import AttendanceTable from '@/components/AttendanceTable';
import PoorPerformers from '@/components/PoorPerformers';
import RecentCheckIns from '@/components/RecentCheckIns';
import RecentCheckOuts from '@/components/RecentCheckOuts';
import ActiveProjects from '@/components/ActiveProjects';
import { Users, UserCheck, UserX, Clock, UserCog, FolderCheck, Calendar, Timer, AlertCircle } from 'lucide-react';
import { AttendanceRecord, Employee, Project } from '@/lib/api';
import PendingLeaveRequestsBanner from '@/components/PendingLeaveRequestsBanner';

async function getDashboardData() {
  try {
    // Get auth token once
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const token = cookieStore.get('auth_token')?.value;
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

    // Make ALL API calls in parallel for maximum performance
    const [employeesRes, attendanceRes, projectsRes, supervisorsRes, leaveStatsRes, timesheetStatsRes] = await Promise.allSettled([
      serverAPI.employees.getAll(),
      // Fetch last 30 days of attendance for accurate performance overview calculation
      serverAPI.attendance.getAll({ 
        sortBy: 'check_in_time', 
        sortOrder: 'desc',
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
      }),
      serverAPI.projects.getAll(),
      serverAPI.supervisors.getAll(),
      // Fetch leave stats in parallel with timeout (using Promise.race for server-side)
      token ? Promise.race([
        fetch(`${apiUrl}/api/leave/admin/statistics`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(r => r.ok ? r.json() : { pendingCount: 0 }).catch(() => ({ pendingCount: 0 })),
        new Promise(resolve => setTimeout(() => resolve({ pendingCount: 0 }), 3000))
      ]) : Promise.resolve({ pendingCount: 0 }),
      // Fetch timesheet stats in parallel with timeout
      token ? Promise.race([
        fetch(`${apiUrl}/api/timesheets/stats`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(r => r.ok ? r.json() : { todayTotalOT: 0, pendingTimesheetApprovals: 0, pendingOTApprovals: 0 }).catch(() => ({ todayTotalOT: 0, pendingTimesheetApprovals: 0, pendingOTApprovals: 0 })),
        new Promise(resolve => setTimeout(() => resolve({ todayTotalOT: 0, pendingTimesheetApprovals: 0, pendingOTApprovals: 0 }), 3000))
      ]) : Promise.resolve({ todayTotalOT: 0, pendingTimesheetApprovals: 0, pendingOTApprovals: 0 }),
    ]);

    // Extract data from settled promises, with fallbacks
    const employeesResData = employeesRes.status === 'fulfilled' 
      ? employeesRes.value 
      : { employees: [] };
    const attendanceResData = attendanceRes.status === 'fulfilled' 
      ? attendanceRes.value 
      : { records: [] };
    const projectsResData = projectsRes.status === 'fulfilled' 
      ? projectsRes.value 
      : { projects: [] };
    const supervisorsResData = supervisorsRes.status === 'fulfilled' 
      ? supervisorsRes.value 
      : { supervisors: [] };
    
    const leaveStats = leaveStatsRes.status === 'fulfilled' ? leaveStatsRes.value : { pendingCount: 0 };
    const timesheetStats = timesheetStatsRes.status === 'fulfilled' ? timesheetStatsRes.value : { todayTotalOT: 0, pendingTimesheetApprovals: 0, pendingOTApprovals: 0 };

    // Log errors if any requests failed
    if (employeesRes.status === 'rejected') {
      console.error('Error fetching employees:', employeesRes.reason);
    }
    if (attendanceRes.status === 'rejected') {
      console.error('Error fetching attendance:', attendanceRes.reason);
    }
    if (projectsRes.status === 'rejected') {
      console.error('Error fetching projects:', projectsRes.reason);
    }
    if (supervisorsRes.status === 'rejected') {
      console.error('Error fetching supervisors:', supervisorsRes.reason);
    }
    if (timesheetStatsRes.status === 'rejected') {
      console.error('Error fetching timesheet stats:', timesheetStatsRes.reason);
    }

    const pendingLeaveRequests = leaveStats.pendingCount || 0;
    const todayTotalOT = timesheetStats.todayTotalOT || 0;
    const pendingTimesheetApprovals = timesheetStats.pendingTimesheetApprovals || 0;
    const pendingOTApprovals = timesheetStats.pendingOTApprovals || 0;

    const employees = employeesResData.employees || [];
    const attendanceRecords = attendanceResData.records || [];
    const projects = projectsResData.projects || [];
    const supervisors = supervisorsResData.supervisors || [];

    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter((record: AttendanceRecord) => {
      const recordDate = new Date(record.check_in_time).toISOString().split('T')[0];
      return recordDate === today;
    });

    // Get unique employees who checked in today
    const presentToday = new Set(
      todayRecords.map((record: AttendanceRecord) => record.user_id)
    ).size;

    const absentToday = employees.length - presentToday;
    const recentActivity = attendanceRecords.slice(0, 10);

    // Calculate supervisors count from supervisors API
    const supervisorsCount = supervisors.length;

    // Calculate completed projects
    const completedProjects = projects.filter((p: any) => 
      p.end_date && new Date(p.end_date) <= new Date()
    ).length;

    // Calculate on hold projects (check status field)
    const onHoldProjects = projects.filter((p: any) => 
      p.status && (p.status.toLowerCase() === 'on_hold' || p.status.toLowerCase() === 'on hold' || p.status === 'ON HOLD')
    ).length;

    return {
      totalWorkers: employees.length,
      supervisors: supervisorsCount,
      presentToday,
      absentToday,
      completedProjects,
      onHoldProjects,
      pendingLeaveRequests,
      todayTotalOT,
      pendingTimesheetApprovals,
      pendingOTApprovals,
      recentActivity,
      employees,
      attendanceRecords,
      projects,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      totalWorkers: 0,
      supervisors: 0,
      presentToday: 0,
      absentToday: 0,
      completedProjects: 0,
      onHoldProjects: 0,
      pendingLeaveRequests: 0,
      todayTotalOT: 0,
      pendingTimesheetApprovals: 0,
      pendingOTApprovals: 0,
      recentActivity: [],
      employees: [],
      attendanceRecords: [],
      projects: [],
    };
  }
}

export default async function DashboardPage() {
  const {
      totalWorkers,
      supervisors,
      presentToday,
      absentToday,
      completedProjects,
      onHoldProjects,
      pendingLeaveRequests,
      todayTotalOT,
      pendingTimesheetApprovals,
      pendingOTApprovals,
      recentActivity,
      employees,
      attendanceRecords,
      projects,
    } = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your workforce management system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Staffs"
          value={totalWorkers}
          subtitle={`${presentToday} active today`}
          icon={<Users className="h-6 w-6 text-primary-600" />}
        />
        <StatCard
          title="Supervisors"
          value={supervisors}
          icon={<UserCog className="h-6 w-6 text-blue-600" />}
        />
        <StatCard
          title="Completed Projects"
          value={completedProjects}
          icon={<FolderCheck className="h-6 w-6 text-green-600" />}
        />
        <StatCard
          title="On Hold"
          value={onHoldProjects}
          icon={<FolderCheck className="h-6 w-6 text-orange-600" />}
        />
      </div>

      {/* Timesheet & OT Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Today's Total OT Hours"
          value={todayTotalOT.toFixed(2)}
          subtitle="Approved overtime hours"
          icon={<Timer className="h-6 w-6 text-yellow-600" />}
        />
        <StatCard
          title="Pending Timesheet Approvals"
          value={pendingTimesheetApprovals}
          subtitle="Awaiting approval"
          icon={<AlertCircle className="h-6 w-6 text-orange-600" />}
        />
        <StatCard
          title="Pending OT Approvals"
          value={pendingOTApprovals}
          subtitle="Overtime requests"
          icon={<Clock className="h-6 w-6 text-red-600" />}
        />
      </div>

      {/* Pending Leave Requests Banner - Clickable */}
      <PendingLeaveRequestsBanner count={pendingLeaveRequests} />

      <PoorPerformers workers={employees} attendanceRecords={attendanceRecords} />

      <ActiveProjects projects={projects} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCheckIns workers={employees} attendanceRecords={attendanceRecords} />
        <RecentCheckOuts workers={employees} attendanceRecords={attendanceRecords} />
      </div>

      <Card title="Recent Attendance Activity">
        <AttendanceTable data={recentActivity} />
      </Card>
    </div>
  );
}

