import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdminNav } from '../components/AdminNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { PageGuide } from '../components/PageGuide';
import { 
  MagnifyingGlassIcon, 
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { notify } from '../utils/notify';
import { exportUsersToCSV } from '../utils/adminReports';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
  essay_count: number;
  rubric_count: number;
  student_count: number;
}

export function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with usage stats
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: profilesData, error: profilesError, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (profilesError) throw profilesError;
      setTotalUsers(count || 0);

      // Aggregated counts per teacher to avoid N+1 queries
      const ids = (profilesData || []).map((p: any) => p.id);

      const [{ data: essayCounts }, { data: rubricCounts }, { data: studentCounts }] = await Promise.all([
        supabase
          .from('essays')
          .select('teacher_id, count:id')
          .in('teacher_id', ids),
        supabase
          .from('rubrics')
          .select('teacher_id, count:id')
          .in('teacher_id', ids),
        supabase
          .from('students')
          .select('teacher_id, count:id')
          .in('teacher_id', ids),
      ]);

      const essayMap = new Map<string, number>((essayCounts as any[] | null)?.map((r: any) => [r.teacher_id, Number(r.count)]) || []);
      const rubricMap = new Map<string, number>((rubricCounts as any[] | null)?.map((r: any) => [r.teacher_id, Number(r.count)]) || []);
      const studentMap = new Map<string, number>((studentCounts as any[] | null)?.map((r: any) => [r.teacher_id, Number(r.count)]) || []);

      const usersWithStats = (profilesData || []).map((profile: any) => ({
        ...profile,
        essay_count: essayMap.get(profile.id) || 0,
        rubric_count: rubricMap.get(profile.id) || 0,
        student_count: studentMap.get(profile.id) || 0,
      }));

      setUsers(usersWithStats);
      setFilteredUsers(usersWithStats);
    } catch (error) {
      console.error('Error fetching users:', error);
      notify.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      notify.success(`Admin status ${!currentStatus ? 'granted' : 'revoked'}`);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating admin status:', error);
      notify.error('Failed to update admin status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminNav />
      <ErrorBoundary fallback={(
        <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Please refresh the page and try again.</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Reload</button>
          </div>
        </div>
      )}>
      <div className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage teacher accounts and permissions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PageGuide
              title="How to use User Management"
              ctaLabel="Page guide"
              summary="Search, paginate, export, and toggle admin access for teachers."
              sections={[
                {
                  title: 'Search & paging',
                  body: <p>Search by email/name; adjust page size (25/50/100) and navigate with Previous/Next.</p>,
                },
                {
                  title: 'Usage snapshots',
                  body: <p>Cards show totals; table lists essays, rubrics, and students per teacher.</p>,
                },
                {
                  title: 'Admin toggle',
                  body: <p>Use Make Admin / Revoke Admin to change privileges, then refresh auto-updates the list.</p>,
                },
                {
                  title: 'Export CSV',
                  body: <p>Download the current dataset for audits or backups.</p>,
                },
              ]}
            />
            <button
              onClick={() => exportUsersToCSV(users)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Admin Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => u.is_admin).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Active This Month</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => u.essay_count > 0).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Essays</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.reduce((sum, u) => sum + u.essay_count, 0)}
            </p>
          </div>
        </div>

        {/* Search & Paging */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-400">Page size:</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              aria-label="Page size"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <UserCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'No users found matching your search' : 'No users yet'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <UserCircleIcon className="h-10 w-10 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.full_name || 'Unnamed User'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="space-y-1">
                          <div>{user.essay_count} essays</div>
                          <div>{user.rubric_count} rubrics</div>
                          <div>{user.student_count} students</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {user.is_admin ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-6 w-6 text-gray-400" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleAdminStatus(user.id, user.is_admin)}
                          className={`px-3 py-1 rounded-md text-xs font-medium ${
                            user.is_admin
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800'
                              : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800'
                          }`}
                        >
                          {user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paging Controls */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {Math.min((page - 1) * pageSize + 1, totalUsers)}-
            {Math.min(page * pageSize, totalUsers)} of {totalUsers} users
          </p>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <button
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => (p * pageSize < totalUsers ? p + 1 : p))}
              disabled={page * pageSize >= totalUsers}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      </ErrorBoundary>
    </div>
  );
}
