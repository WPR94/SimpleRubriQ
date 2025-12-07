import { useEffect, useState } from 'react';
import { getAllActivityLogs, getActivityStats } from '../utils/activityLogger';
import { AdminNav } from '../components/AdminNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { PageGuide } from '../components/PageGuide';
import { 
  ClockIcon, 
  UserIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { exportActivityLogsToCSV } from '../utils/adminReports';

interface ActivityLog {
  id: string;
  action_type: string;
  action_details: any;
  created_at: string;
  user_email: string;
  user_name: string;
}

export function AdminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<{ total: number; byAction: Record<string, number> }>({ total: 0, byAction: {} });
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    fetchData();
  }, [limit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        getAllActivityLogs(limit),
        getActivityStats(30)
      ]);
      setLogs(logsData as ActivityLog[]);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    const colors: Record<string, string> = {
      login: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      logout: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
      essay_submit: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      rubric_create: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      student_add: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
      feedback_generate: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      admin_access: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    };
    return colors[action] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
  };

  const formatActionType = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredLogs = filterAction === 'all' 
    ? logs 
    : logs.filter(log => log.action_type === filterAction);

  const actionTypes = ['all', ...Object.keys(stats.byAction).sort()];

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
              Activity Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Audit trail of all user actions (Last 30 days)
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <PageGuide
              title="How to use Activity Logs"
              ctaLabel="Page guide"
              summary="Filter, export, and audit recent user actions."
              sections={[
                {
                  title: 'Filter quickly',
                  body: <p>Use the action filter and result limit to narrow to specific events or time windows.</p>,
                },
                {
                  title: 'Badge legend',
                  body: <p>Colours map to actions (logins, essay submissions, rubric creation, etc.).</p>,
                },
                {
                  title: 'Export & refresh',
                  body: <p>Export CSV for audits or monitoring; hit Refresh to pull the latest 30-day snapshot.</p>,
                },
                {
                  title: 'Inspect details',
                  body: <p>Expand rows to read structured action details for troubleshooting.</p>,
                },
              ]}
            />
            <button
              onClick={() => exportActivityLogsToCSV(filteredLogs)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export CSV
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Actions</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          </div>
          {Object.entries(stats.byAction).slice(0, 5).map(([action, count]) => (
            <div key={action} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{formatActionType(action)}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            </div>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              aria-label="Filter by action type"
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {actionTypes.map(action => (
                <option key={action} value={action}>
                  {action === 'all' ? 'All Actions' : formatActionType(action)}
                </option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              aria-label="Limit number of results"
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
              <option value={250}>Last 250</option>
              <option value={500}>Last 500</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-auto">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center">
                      <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">No activity logs found</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.user_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {log.user_email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionBadgeColor(log.action_type)}`}>
                          {formatActionType(log.action_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {log.action_details ? (
                          <pre className="text-xs max-w-md overflow-x-auto">
                            {JSON.stringify(log.action_details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-gray-400">No details</span>
                        )}
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
