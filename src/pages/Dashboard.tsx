import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '../hooks/useKeyboardShortcuts';
import { OnboardingTour, useOnboardingTour } from '../components/OnboardingTour';
import { useDashboardStats, useFeedbackData } from '../hooks/useDashboard';
import { PageGuide } from '../components/PageGuide';

function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // React Query hooks for data fetching
  const { data: statsData, isLoading: statsLoading, isError: statsError } = useDashboardStats();
  const { data: feedbackData, isLoading: chartsLoading } = useFeedbackData();

  const stats = statsData?.stats ?? null;
  const recentFeedback = statsData?.recentFeedback ?? [];

  // Onboarding tour
  const { showTour, completeTour, skipTour, resetTour } = useOnboardingTour('simple-rubriq-dashboard-tour');

  const tourSteps = [
    {
      target: '[data-tour="stats"]',
      title: '👋 Welcome to Simple Rubriq!',
      content: 'Start here: a snapshot of essays, rubrics, and feedback counts. Use this to confirm your latest grading runs saved correctly.',
      placement: 'bottom' as const,
    },
    {
      target: '[data-tour="essay-feedback"]',
      title: '✍️ Grade an Essay',
      content: 'Paste or upload an essay, select a rubric, choose a tone, and generate feedback. Save to log it to history automatically.',
      placement: 'top' as const,
    },
    {
      target: '[data-tour="rubrics"]',
      title: '📋 Tune Your Rubrics',
      content: 'Create or edit rubrics so AI feedback matches your criteria. Reuse rubrics across classes to keep grading consistent.',
      placement: 'top' as const,
    },
    {
      target: '[data-tour="students"]',
      title: '👥 Organize Students',
      content: 'Import or add students, then link essays to them for cleaner tracking and reporting.',
      placement: 'top' as const,
    },
    {
      target: '[data-tour="analytics"]',
      title: '📊 Spot Trends',
      content: 'See score trends and distributions. Export to CSV when you need to share or archive results.',
      placement: 'top' as const,
    },
  ];

  // Memoized chart datasets
  const trendChartData = useMemo(() => (feedbackData || []).slice(0, 10).reverse(), [feedbackData]);
  const scoreDistributionData = useMemo(() => {
    const data = feedbackData || [];
    return [
      { range: '0-20', count: data.filter(f => f.overall_score >= 0 && f.overall_score < 20).length },
      { range: '20-40', count: data.filter(f => f.overall_score >= 20 && f.overall_score < 40).length },
      { range: '40-60', count: data.filter(f => f.overall_score >= 40 && f.overall_score < 60).length },
      { range: '60-80', count: data.filter(f => f.overall_score >= 60 && f.overall_score < 80).length },
      { range: '80-100', count: data.filter(f => f.overall_score >= 80 && f.overall_score <= 100).length },
    ];
  }, [feedbackData]);

  // Calculate Class Insights
  const classInsights = useMemo(() => {
    if (!feedbackData || feedbackData.length === 0) return null;

    const allImprovements: string[] = [];
    const allStrengths: string[] = [];

    feedbackData.forEach(f => {
      if (f.improvements) allImprovements.push(...f.improvements);
      if (f.strengths) allStrengths.push(...f.strengths);
    });

    const getTop3 = (arr: string[]) => {
      const counts: Record<string, number> = {};
      arr.forEach(item => {
        // Simple normalization to group similar feedback
        // In a real app, you might use more advanced NLP clustering here
        const key = item.trim(); 
        counts[key] = (counts[key] || 0) + 1;
      });
      
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([text, count]) => ({ text, count }));
    };

    return {
      commonPitfalls: getTop3(allImprovements),
      commonStrengths: getTop3(allStrengths)
    };
  }, [feedbackData]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'e',
      ctrl: true,
      callback: () => navigate('/essay-feedback'),
      description: 'New Essay Feedback',
    },
    {
      key: 'r',
      ctrl: true,
      callback: () => navigate('/rubrics'),
      description: 'Manage Rubrics',
    },
    {
      key: 'h',
      ctrl: true,
      callback: () => navigate('/feedback-history'),
      description: 'View History',
    },
    {
      key: '?',
      callback: () => setShowShortcuts(true),
      description: 'Show Keyboard Shortcuts',
    },
  ]);

  // Realtime subscription to invalidate queries on feedback inserts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-feedback-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, () => {
        // Invalidate both queries to trigger refetch
        queryClient.invalidateQueries(['dashboard', 'stats', user.id]);
        queryClient.invalidateQueries(['dashboard', 'feedback', user.id]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {getGreeting()}, {profile?.full_name || 'Teacher'}! 👋
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                Here's what's happening with your students today.
              </p>
            </div>
            <div className="flex gap-3">
               <Link
                  to="/essay-feedback"
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  New Feedback
                </Link>
            </div>
          </div>

          {/* Quickstart & How-To */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <span>🚀 Quickstart</span>
                <span className="text-gray-400">(best flow to use the app)</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Upload or paste an essay in <Link to="/essay-feedback" className="text-blue-600 hover:underline">Essay Feedback</Link>, pick a rubric, and generate feedback.</li>
                <li>Review AI feedback, adjust as needed, then save—it auto-logs in your history.</li>
                <li>Track scores and trends here on the dashboard; jump to <Link to="/analytics" className="text-blue-600 hover:underline">Analytics</Link> for deeper insights.</li>
                <li>Keep rubrics fresh in <Link to="/rubrics" className="text-blue-600 hover:underline">Rubrics</Link> and manage students in <Link to="/students" className="text-blue-600 hover:underline">Students</Link> for clean records.</li>
              </ol>
              <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">⌨️ Ctrl + E to open Essay Feedback</span>
                <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">⌨️ Ctrl + R manage Rubrics</span>
                <span className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">⌨️ Ctrl + H feedback history</span>
                <button
                  type="button"
                  onClick={() => setShowShortcuts(true)}
                  className="text-blue-600 hover:underline"
                  title="Open keyboard shortcuts"
                >
                  See all shortcuts
                </button>
              </div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
                <span>🧭 How this page is organized</span>
              </div>
              <ul className="space-y-2 text-sm text-indigo-900">
                <li><strong>Stats</strong>: Totals for essays, rubrics, and feedback.</li>
                <li><strong>Charts</strong>: Trends and score distribution from recent feedback.</li>
                <li><strong>Insights</strong>: Common strengths/pitfalls across classes.</li>
                <li><strong>Recent feedback</strong>: Jump back into the latest essays.</li>
              </ul>
              <button
                type="button"
                onClick={() => (showTour ? skipTour() : resetTour())}
                className="inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {showTour ? 'Skip tour' : 'Replay guided tour'}
              </button>
              <PageGuide
                title="Dashboard Guide"
                summary="Know where to click and why."
                ctaLabel="Open dashboard guide"
                sections={[
                  {
                    title: 'Stats cards',
                    body: (
                      <p>
                        Quick totals for essays, rubrics, and feedback. Use them to sanity-check that your latest runs
                        saved correctly.
                      </p>
                    ),
                  },
                  {
                    title: 'Charts',
                    body: (
                      <p>
                        Trend and distribution of recent feedback scores. Hover to see values; export deeper data from
                        the Analytics page when needed.
                      </p>
                    ),
                  },
                  {
                    title: 'Insights',
                    body: (
                      <p>
                        Common strengths and pitfalls aggregated from recent feedback. Use this to tailor reteach plans.
                      </p>
                    ),
                  },
                  {
                    title: 'Recent feedback',
                    body: (
                      <p>
                        Jump back into the most recent essays. Great for quick follow-ups or exporting a specific run.
                      </p>
                    ),
                  },
                  {
                    title: 'Shortcuts',
                    body: (
                      <p>
                        Ctrl+E: new feedback · Ctrl+R: rubrics · Ctrl+H: history · ?: shortcut help. Replay the tour any time.
                      </p>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {statsLoading ? (
            <DashboardSkeleton />
          ) : statsError ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-red-600 mb-4">Failed to load dashboard data</p>
              <button 
                onClick={() => queryClient.invalidateQueries(['dashboard', 'stats', user?.id])} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8" data-tour="stats">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Total Essays</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.essaysCount ?? 0}</p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Rubrics Created</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.rubricsCount ?? 0}</p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium">Feedback Generated</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.feedbackCount ?? 0}</p>
                    </div>
                    <div className="bg-purple-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Feedback Trend Chart */}
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Feedback Trend (Last 30)</h3>
                  {chartsLoading ? (
                    <ChartSkeleton />
                  ) : (feedbackData && feedbackData.length > 0) ? (
                    <div className="w-full overflow-x-auto">
                      <ResponsiveContainer width="100%" height={250} minWidth={300}>
                        <AreaChart data={trendChartData}>
                          <defs>
                            <linearGradient id="colorScoreDashboard" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis
                            dataKey="created_at"
                            tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            fontSize={12}
                            tick={{ fill: '#6B7280' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            fontSize={12} 
                            tick={{ fill: '#6B7280' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              borderRadius: '0.5rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              border: 'none',
                              padding: '8px 12px'
                            }}
                            labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            formatter={(value: any) => [`${value}/100`, 'Score']}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Area 
                            type="monotone" 
                            dataKey="overall_score" 
                            stroke="#3B82F6" 
                            strokeWidth={3} 
                            fillOpacity={1}
                            fill="url(#colorScoreDashboard)"
                            name="Score" 
                            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-10">No feedback data yet</div>
                  )}
                </div>

                {/* Score Distribution Chart */}
                <div className="bg-white rounded-lg shadow p-4 sm:p-6 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
                  {chartsLoading ? (
                    <ChartSkeleton />
                  ) : (feedbackData && feedbackData.length > 0) ? (
                    <div className="w-full overflow-x-auto">
                      <ResponsiveContainer width="100%" height={250} minWidth={300}>
                        <BarChart data={scoreDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis 
                            dataKey="range" 
                            fontSize={12} 
                            tick={{ fill: '#6B7280' }}
                            axisLine={false}
                            tickLine={false}
                            dy={10}
                          />
                          <YAxis 
                            fontSize={12} 
                            tick={{ fill: '#6B7280' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            cursor={{ fill: '#F3F4F6' }}
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              borderRadius: '0.5rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                              border: 'none',
                              padding: '8px 12px'
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: '20px' }} />
                          <Bar 
                            dataKey="count" 
                            fill="#10B981" 
                            name="Essays" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-10">No distribution data yet</div>
                  )}
                </div>
              </div>

              {/* Class Insights Section */}
              {classInsights && (classInsights.commonPitfalls.length > 0 || classInsights.commonStrengths.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8" data-tour="analytics">
                  {/* Common Pitfalls */}
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">⚠️</span> Common Pitfalls
                    </h3>
                    {classInsights.commonPitfalls.length > 0 ? (
                      <ul className="space-y-3">
                        {classInsights.commonPitfalls.map((item, idx) => (
                          <li key={idx} className="flex items-start justify-between text-sm">
                            <span className="text-gray-700 flex-1 mr-2">{item.text}</span>
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold whitespace-nowrap">
                              {item.count} students
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No common pitfalls detected yet.</p>
                    )}
                  </div>

                  {/* Class Strengths */}
                  <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">💪</span> Class Strengths
                    </h3>
                    {classInsights.commonStrengths.length > 0 ? (
                      <ul className="space-y-3">
                        {classInsights.commonStrengths.map((item, idx) => (
                          <li key={idx} className="flex items-start justify-between text-sm">
                            <span className="text-gray-700 flex-1 mr-2">{item.text}</span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold whitespace-nowrap">
                              {item.count} students
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">No common strengths detected yet.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow mb-8">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">Recent Feedback</h3>
                  {recentFeedback.length > 0 && (
                    <Link
                      to="/feedback-history"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View All →
                    </Link>
                  )}
                </div>
                <div className="p-6">
                  {recentFeedback.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No feedback generated yet</p>
                  ) : (
                    <ul className="space-y-3">
                      {recentFeedback.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={`/feedback-history?id=${item.id}`}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors group"
                          >
                            <div>
                              <p className="font-medium text-gray-900 group-hover:text-blue-700">{item.essay_title}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                      to="/essay-feedback"
                      data-tour="essay-feedback"
                      className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="font-semibold text-gray-900 group-hover:text-blue-600">Generate Essay Feedback</p>
                        <p className="text-sm text-gray-500">Upload and analyze essays</p>
                      </div>
                    </Link>

                    <Link
                      to="/rubrics"
                      data-tour="rubrics"
                      className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors group"
                    >
                      <div className="bg-green-100 rounded-lg p-3 group-hover:bg-green-200 transition-colors">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="font-semibold text-gray-900 group-hover:text-green-600">Manage Rubrics</p>
                        <p className="text-sm text-gray-500">Create and edit grading criteria</p>
                      </div>
                    </Link>

                    <Link
                      to="/students"
                      data-tour="students"
                      className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors group"
                    >
                      <div className="bg-purple-100 rounded-lg p-3 group-hover:bg-purple-200 transition-colors">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="font-semibold text-gray-900 group-hover:text-purple-600">Manage Students</p>
                        <p className="text-sm text-gray-500">View and organize students</p>
                      </div>
                    </Link>

                    <Link
                      to="/analytics"
                      data-tour="analytics"
                      className="flex items-center p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors group"
                    >
                      <div className="bg-orange-100 rounded-lg p-3 group-hover:bg-orange-200 transition-colors">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <p className="font-semibold text-gray-900 group-hover:text-orange-600">View Analytics</p>
                        <p className="text-sm text-gray-500">Track performance and trends</p>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </ErrorBoundary>

      <KeyboardShortcutsHelp
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={[
          { keys: 'Ctrl+E', description: 'New Essay Feedback' },
          { keys: 'Ctrl+R', description: 'Manage Rubrics' },
          { keys: 'Ctrl+H', description: 'View History' },
          { keys: '?', description: 'Show Keyboard Shortcuts' },
        ]}
      />

      {showTour && (
        <OnboardingTour
          steps={tourSteps}
          onComplete={completeTour}
          onSkip={skipTour}
        />
      )}
    </>
  );
}

export default Dashboard;