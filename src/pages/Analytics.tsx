import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import notify from '../utils/notify';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import { exportToCSV } from '../utils/csvExport';

interface FeedbackData {
  id: string;
  essay_id: string;
  overall_score: number;
  created_at: string;
  essay_title: string;
  rubric_name: string;
  student_name?: string;
}

interface GradeDistribution {
  range: string;
  count: number;
}

interface TrendData {
  date: string;
  avgScore: number;
  count: number;
}

interface RubricPerformance {
  name: string;
  avgScore: number;
  count: number;
}

interface StudentPerformance {
  name: string;
  avgScore: number;
  essayCount: number;
  trend: 'up' | 'down' | 'stable';
}

function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [feedbackData, setFeedbackData] = useState<FeedbackData[]>([]);
  const [metrics, setMetrics] = useState({
    essaysGraded: 0,
    timeSavedHours: 0,
    averageScore: 0,
    medianScore: 0,
    standardDeviation: 0,
  });
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [rubricPerformance, setRubricPerformance] = useState<RubricPerformance[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fast preflight: any feedback for this teacher?
      const { count: fbCount, error: fbCountError } = await supabase
        .from('feedback')
        .select('id, essays!inner(teacher_id)', { count: 'exact', head: true })
        .eq('essays.teacher_id', user!.id);

      if (fbCountError) throw fbCountError;

      if (!fbCount || fbCount === 0) {
        setMetrics({
          essaysGraded: 0,
          timeSavedHours: 0,
          averageScore: 0,
          medianScore: 0,
          standardDeviation: 0,
        });
        setFeedbackData([]);
        setGradeDistribution([]);
        setTrendData([]);
        setRubricPerformance([]);
        setLoading(false);
        return;
      }

      // Load feedback joined to essays for this teacher (limit to recent subset)
      const { data: feedbackJoined, error: feedbackError } = await supabase
        .from('feedback')
        .select('id, essay_id, overall_score, created_at, essays!inner(id,title,rubric_id,teacher_id, students(name))')
        .eq('essays.teacher_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (feedbackError) throw feedbackError;

      const rubricIdSet = new Set<string>();
      (feedbackJoined || []).forEach((row: any) => {
        const rid = row.essays?.rubric_id;
        if (rid) rubricIdSet.add(rid);
      });

      // Load only used rubrics for name lookup
      let rubricMap = new Map<string, string>();
      if (rubricIdSet.size > 0) {
        const { data: rubricsData, error: rubricsError } = await supabase
          .from('rubrics')
          .select('id, name')
          .in('id', Array.from(rubricIdSet));
        
        // If rubrics fail to load, we can still proceed with just IDs or placeholders
        if (!rubricsError && rubricsData) {
          rubricMap = new Map((rubricsData || []).map((r: any) => [r.id, r.name]));
        } else {
          console.warn('Failed to load rubric names for analytics', rubricsError);
        }
      }

      // Transform feedback data
      const transformedFeedback: FeedbackData[] = (feedbackJoined || []).map((f: any) => {
        const essayTitle = f.essays?.title || 'Untitled Essay';
        const rname = f.essays?.rubric_id ? rubricMap.get(f.essays.rubric_id) || '—' : '—';
        const sname = f.essays?.students?.name || 'Unknown Student';
        return {
          id: f.id,
          essay_id: f.essay_id,
          overall_score: f.overall_score,
          created_at: f.created_at,
          essay_title: essayTitle,
          rubric_name: rname,
          student_name: sname,
        };
      });

      setFeedbackData(transformedFeedback);

      // Calculate metrics
      if (transformedFeedback.length > 0) {
        const scores = transformedFeedback.map(f => f.overall_score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        // Calculate median
        const sortedScores = [...scores].sort((a, b) => a - b);
        const median = sortedScores.length % 2 === 0
          ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
          : sortedScores[Math.floor(sortedScores.length / 2)];
        
        // Calculate standard deviation
        const squaredDifferences = scores.map(score => Math.pow(score - avgScore, 2));
        const avgSquaredDiff = squaredDifferences.reduce((a, b) => a + b, 0) / scores.length;
        const stdDev = Math.sqrt(avgSquaredDiff);
        
        // Calculate time saved (estimated 15 minutes per essay)
        const minutesSaved = transformedFeedback.length * 15;
        const hoursSaved = Math.round((minutesSaved / 60) * 10) / 10;

        setMetrics({
          essaysGraded: transformedFeedback.length,
          timeSavedHours: hoursSaved,
          averageScore: Math.round(avgScore),
          medianScore: Math.round(median),
          standardDeviation: Math.round(stdDev * 10) / 10,
        });

        // Calculate grade distribution
        const distribution: { [key: string]: number } = {
          '90-100': 0,
          '80-89': 0,
          '70-79': 0,
          '60-69': 0,
          '50-59': 0,
          '0-49': 0,
        };

        transformedFeedback.forEach(f => {
          const score = f.overall_score;
          if (score >= 90) distribution['90-100']++;
          else if (score >= 80) distribution['80-89']++;
          else if (score >= 70) distribution['70-79']++;
          else if (score >= 60) distribution['60-69']++;
          else if (score >= 50) distribution['50-59']++;
          else distribution['0-49']++;
        });

        setGradeDistribution(
          Object.entries(distribution).map(([range, count]) => ({ range, count }))
        );

        // Calculate trend data (last 30 days)
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);

        const recentFeedback = transformedFeedback.filter(
          f => new Date(f.created_at) >= last30Days
        );

        // Group by date
        const dateGroups: { [key: string]: number[] } = {};
        recentFeedback.forEach(f => {
          const date = new Date(f.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
          if (!dateGroups[date]) dateGroups[date] = [];
          dateGroups[date].push(f.overall_score);
        });

        const trend = Object.entries(dateGroups)
          .map(([date, scores]) => ({
            date,
            avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
            count: scores.length,
          }))
          .slice(-14);

        setTrendData(trend);

        // Calculate rubric performance
        const rubricGroups: { [key: string]: number[] } = {};
        transformedFeedback.forEach(f => {
          if (!rubricGroups[f.rubric_name]) rubricGroups[f.rubric_name] = [];
          rubricGroups[f.rubric_name].push(f.overall_score);
        });

        const performance = Object.entries(rubricGroups).map(([name, scores]) => ({
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          count: scores.length,
        }));

        setRubricPerformance(performance);

        // Calculate Student Performance
        const studentGroups: { [key: string]: { scores: number[], dates: Date[] } } = {};
        transformedFeedback.forEach(f => {
          if (f.student_name && f.student_name !== 'Unknown Student') {
            if (!studentGroups[f.student_name]) studentGroups[f.student_name] = { scores: [], dates: [] };
            studentGroups[f.student_name].scores.push(f.overall_score);
            studentGroups[f.student_name].dates.push(new Date(f.created_at));
          }
        });

        const studentPerf = Object.entries(studentGroups).map(([name, data]) => {
          const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
          
          // Determine trend (compare last score to average of previous)
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (data.scores.length >= 2) {
            // Sort by date
            const sorted = data.scores.map((s, i) => ({ s, d: data.dates[i] })).sort((a, b) => a.d.getTime() - b.d.getTime());
            const lastScore = sorted[sorted.length - 1].s;
            const prevScore = sorted[sorted.length - 2].s;
            if (lastScore > prevScore + 5) trend = 'up';
            else if (lastScore < prevScore - 5) trend = 'down';
          }

          return {
            name,
            avgScore,
            essayCount: data.scores.length,
            trend
          };
        });

        setStudentPerformance(studentPerf);
      }
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      notify.error('Failed to load analytics data');
      // Ensure we show empty state on error
      setMetrics({
        essaysGraded: 0,
        timeSavedHours: 0,
        averageScore: 0,
        medianScore: 0,
        standardDeviation: 0,
      });
      setFeedbackData([]);
      setGradeDistribution([]);
      setTrendData([]);
      setRubricPerformance([]);
      setStudentPerformance([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = feedbackData.map(item => ({
      'Essay Title': item.essay_title,
      'Rubric Name': item.rubric_name,
      'Score': item.overall_score,
      'Date': new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `simple-rubriq-analytics-${timestamp}.csv`;

    try {
      exportToCSV(exportData, filename);
      notify.success('Analytics data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      notify.error('Failed to export data');
    }
  };

  const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
  const COLOR_CLASSES = ['bg-violet-500','bg-pink-500','bg-amber-500','bg-emerald-500','bg-blue-500','bg-red-500'];
  const gradeDistributionData = useMemo(() => gradeDistribution, [gradeDistribution]) as any;

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : feedbackData.length === 0 ? (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900">Analytics Dashboard</h2>
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Yet</h3>
            <p className="text-gray-600 mb-4">
              Start grading essays to see analytics and insights here.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Analytics Dashboard</h2>
              <p className="text-sm sm:text-base text-gray-600 mt-1">Track performance and trends across your graded essays</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Essays Graded</h3>
                <p className="text-3xl font-bold text-gray-900">{metrics.essaysGraded}</p>
                <p className="text-xs text-gray-500 mt-2">Total assignments</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Time Saved</h3>
                <p className="text-3xl font-bold text-green-600">{metrics.timeSavedHours}h</p>
                <p className="text-xs text-gray-500 mt-2">~{Math.round(metrics.timeSavedHours * 60)} mins</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Average Score</h3>
                <p className="text-3xl font-bold text-gray-900">{metrics.averageScore}%</p>
                <p className="text-xs text-gray-500 mt-2">Mean performance</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Median Score</h3>
                <p className="text-3xl font-bold text-gray-900">{metrics.medianScore}%</p>
                <p className="text-xs text-gray-500 mt-2">Typical score</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-1">Score Spread</h3>
                <p className="text-3xl font-bold text-gray-900">{metrics.standardDeviation}</p>
                <p className="text-xs text-gray-500 mt-2">Consistency</p>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Student Performance Insights */}
          {studentPerformance.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Students at Risk */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden border border-red-100">
                <div className="bg-red-50 px-6 py-4 border-b border-red-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-red-800 flex items-center gap-2">
                    <span className="text-xl">⚠️</span> Students at Risk
                  </h3>
                  <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
                    Avg &lt; 60%
                  </span>
                </div>
                <div className="p-0">
                  {studentPerformance.filter(s => s.avgScore < 60).length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3">Student</th>
                          <th className="px-6 py-3">Avg Score</th>
                          <th className="px-6 py-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentPerformance
                          .filter(s => s.avgScore < 60)
                          .sort((a, b) => a.avgScore - b.avgScore)
                          .slice(0, 5)
                          .map((student, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-3 font-medium text-gray-900">{student.name}</td>
                              <td className="px-6 py-3">
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold">
                                  {student.avgScore}%
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                {student.trend === 'down' && <span className="text-red-600">↘ Declining</span>}
                                {student.trend === 'up' && <span className="text-green-600">↗ Improving</span>}
                                {student.trend === 'stable' && <span className="text-gray-500">→ Stable</span>}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <p>🎉 No students currently flagged as at-risk.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Performers */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden border border-green-100">
                <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                    <span className="text-xl">🏆</span> Top Performers
                  </h3>
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    Avg &gt; 85%
                  </span>
                </div>
                <div className="p-0">
                  {studentPerformance.filter(s => s.avgScore >= 85).length > 0 ? (
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3">Student</th>
                          <th className="px-6 py-3">Avg Score</th>
                          <th className="px-6 py-3">Essays</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentPerformance
                          .filter(s => s.avgScore >= 85)
                          .sort((a, b) => b.avgScore - a.avgScore)
                          .slice(0, 5)
                          .map((student, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-3 font-medium text-gray-900">{student.name}</td>
                              <td className="px-6 py-3">
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded font-bold">
                                  {student.avgScore}%
                                </span>
                              </td>
                              <td className="px-6 py-3 text-gray-600">
                                {student.essayCount} graded
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-gray-500">
                      <p>Keep grading to identify top performers.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Grade Distribution */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md overflow-hidden">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Grade Distribution</h3>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={window.innerWidth < 768 ? 350 : 300} minWidth={320}>
                  <BarChart data={gradeDistributionData as any} margin={{ top: 5, right: 10, left: -20, bottom: window.innerWidth < 768 ? 50 : 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" angle={window.innerWidth < 768 ? -45 : 0} textAnchor={window.innerWidth < 768 ? 'end' : 'middle'} height={window.innerWidth < 768 ? 80 : 30} />
                    <YAxis width={window.innerWidth < 768 ? 40 : 60} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8b5cf6" name="Number of Essays" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md overflow-hidden">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Score Breakdown</h3>
              {window.innerWidth < 768 ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
                    {gradeDistribution.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div 
                          className={`w-4 h-4 rounded-full flex-shrink-0 ${COLOR_CLASSES[idx % COLOR_CLASSES.length]}`}
                        />
                        <div>
                          <p className="text-xs text-gray-600 font-medium">{item.range}</p>
                          <p className="text-sm font-bold text-gray-900">{item.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={300} minWidth={300}>
                    <PieChart>
                      <Pie
                        data={gradeDistributionData as any}
                        dataKey="count"
                        nameKey="range"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.range}: ${entry.count}`}
                      >
                        {gradeDistribution.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} essays`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Trend Over Time */}
          {trendData.length > 0 && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6 overflow-hidden">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Score Trends (Last 30 Days)</h3>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={300} minWidth={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgScore"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Average Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Rubric Performance */}
          {rubricPerformance.length > 0 && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-8">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Performance by Rubric</h3>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width="100%" height={300} minWidth={400}>
                  <BarChart data={rubricPerformance} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Legend />
                    <Bar dataKey="avgScore" fill="#10b981" name="Average Score" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Graded Essays Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Recent Graded Essays</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Essay Title</th>
                    <th className="px-6 py-3">Rubric</th>
                    <th className="px-6 py-3">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {feedbackData.slice(0, 10).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-600">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {item.student_name || 'Unknown'}
                      </td>
                      <td className="px-6 py-3 text-gray-900">{item.essay_title}</td>
                      <td className="px-6 py-3 text-gray-600">{item.rubric_name}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded font-bold ${
                          item.overall_score >= 80 ? 'bg-green-100 text-green-800' :
                          item.overall_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {item.overall_score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </ErrorBoundary>
    </>
  );
}

export default Analytics;
