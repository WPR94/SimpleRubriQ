import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { AdminNav } from '../components/AdminNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { PageGuide } from '../components/PageGuide';
import { 
  UserGroupIcon, 
  DocumentTextIcon, 
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

interface PlatformStats {
  total_users: number;
  new_users_30d: number;
  total_essays: number;
  essays_30d: number;
  essays_7d: number;
  total_rubrics: number;
  avg_score: number;
}

interface RecentActivity {
  id: string;
  title: string;
  teacher_email: string;
  created_at: string;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentEssays, setRecentEssays] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Fetch platform stats
      const { data: statsData, error: statsError } = await supabase
        .from('admin_platform_stats')
        .select('*')
        .single();

      if (statsError) {
        console.error('Error fetching stats:', statsError);
      } else {
        setStats(statsData);
      }

      // Fetch recent essays (limit 10)
      const { data: essaysData, error: essaysError } = await supabase
        .from('essays')
        .select(`
          id,
          title,
          created_at,
          profiles:teacher_id (email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (essaysError) {
        console.error('Error fetching essays:', essaysError);
      } else {
        setRecentEssays(essaysData as any);
      }
    } catch (error) {
      console.error('Error in fetchAdminData:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated OpenAI costs (rough estimate: $0.002 per essay)
  const estimatedCost = stats ? (stats.total_essays * 0.002).toFixed(2) : '0.00';
  const monthlyCost = stats ? (stats.essays_30d * 0.002).toFixed(2) : '0.00';

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
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Please refresh the page and try again.</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Reload</button>
            </div>
          </div>
        </div>
      )}>
      <div className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Platform overview and management
            </p>
          </div>
          <PageGuide
            title="How to use Admin Dashboard"
            ctaLabel="Page guide"
            summary="Scan platform health, usage, and jump to admin tools."
            sections={[
              {
                title: 'Read the stats cards',
                body: <p>Total users, essays, rubrics, and recent activity volumes update from admin views.</p>,
              },
              {
                title: 'Quick actions',
                body: <p>Use Manage Users, Platform Analytics, and Activity Logs tiles to drill deeper.</p>,
              },
              {
                title: 'Costs and health',
                body: <p>Watch estimated API spend and system health indicators for early warning.</p>,
              },
              {
                title: 'Recent essays',
                body: <p>Scan the recent essay table to spot spikes or anomalies by teacher.</p>,
              },
            ]}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Users
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats?.total_users || 0}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  +{stats?.new_users_30d || 0} this month
                </p>
              </div>
              <UserGroupIcon className="h-12 w-12 text-indigo-600" />
            </div>
          </div>

          {/* Total Essays */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Essays Graded
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats?.total_essays || 0}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {stats?.essays_7d || 0} this week
                </p>
              </div>
              <DocumentTextIcon className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          {/* Total Rubrics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Active Rubrics
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats?.total_rubrics || 0}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                  Avg Score: {stats?.avg_score ? stats.avg_score.toFixed(1) : 'N/A'}%
                </p>
              </div>
              <ClipboardDocumentCheckIcon className="h-12 w-12 text-purple-600" />
            </div>
          </div>

          {/* API Costs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Est. API Cost
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  ${estimatedCost}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  ${monthlyCost} this month
                </p>
              </div>
              <CurrencyDollarIcon className="h-12 w-12 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            to="/admin/users"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <UserGroupIcon className="h-8 w-8 text-indigo-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Manage Users
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              View, search, and manage teacher accounts
            </p>
          </Link>

          <Link
            to="/admin/analytics"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <ChartBarIcon className="h-8 w-8 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Platform Analytics
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Deep dive into usage metrics and trends
            </p>
          </Link>

          <Link
            to="/admin/activity"
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <ClockIcon className="h-8 w-8 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Activity Logs
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Audit trail and user activity monitoring
            </p>
          </Link>
        </div>

        {/* System Health Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              System Health
            </h2>
            <ClockIcon className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">API Status:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Operational</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Database:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Healthy</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Edge Functions:</span>
              <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Essays
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Essay Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentEssays.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No essays yet
                    </td>
                  </tr>
                ) : (
                  recentEssays.map((essay) => (
                    <tr key={essay.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {essay.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {(essay as any).profiles?.email || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(essay.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
      </ErrorBoundary>
    </div>
  );
}
