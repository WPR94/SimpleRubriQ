import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdminNav } from '../components/AdminNav';
import ErrorBoundary from '../components/ErrorBoundary';
import { PageGuide } from '../components/PageGuide';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface GrowthData {
  date: string;
  users: number;
  essays: number;
}

export function AdminAnalytics() {
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Get data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: essaysData, error: essaysError } = await supabase
        .from('essays')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (essaysError || usersError) {
        console.error('Error fetching analytics:', essaysError || usersError);
        return;
      }

      // Group by date
      const dataByDate: Record<string, { users: number; essays: number }> = {};

      // Initialize all dates in range
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dataByDate[dateStr] = { users: 0, essays: 0 };
      }

      // Count users by date
      (usersData || []).forEach((user) => {
        const dateStr = user.created_at.split('T')[0];
        if (dataByDate[dateStr]) {
          dataByDate[dateStr].users++;
        }
      });

      // Count essays by date
      (essaysData || []).forEach((essay) => {
        const dateStr = essay.created_at.split('T')[0];
        if (dataByDate[dateStr]) {
          dataByDate[dateStr].essays++;
        }
      });

      // Convert to array and sort
      const chartData = Object.entries(dataByDate)
        .map(([date, counts]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          ...counts,
        }))
        .reverse();

      setGrowthData(chartData);
    } catch (error) {
      console.error('Error in fetchAnalytics:', error);
    } finally {
      setLoading(false);
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Platform Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Usage trends and growth metrics (Last 30 days)
            </p>
          </div>
          <div className="mb-8">
            <PageGuide
              title="How to use Platform Analytics"
              ctaLabel="Page guide"
              summary="30-day admin view of user growth and essay volume."
              sections={[
                {
                  title: 'Data window',
                  body: <p>Charts pull the last 30 days of profiles created and essays submitted.</p>,
                },
                {
                  title: 'User growth chart',
                  body: <p>Hover to read daily signups; legend toggles series if you need to focus.</p>,
                },
                {
                  title: 'Essay activity chart',
                  body: <p>Bars show daily essay counts; useful to spot peaks or outages.</p>,
                },
                {
                  title: 'Refresh cadence',
                  body: <p>Data loads on page open; refresh the page after major imports or backfills.</p>,
                },
              ]}
            />
          </div>

        {/* User Growth Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            User Growth
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="users" 
                stroke="#6366F1" 
                strokeWidth={2}
                name="New Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Essay Activity Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Essay Activity
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Bar 
                dataKey="essays" 
                fill="#10B981" 
                name="Essays Graded"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        </div>
      </div>
      </ErrorBoundary>
    </div>
  );
}
