import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import notify from '../utils/notify';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import { ListItemSkeleton } from '../components/LoadingSkeleton';
import ConfirmModal from '../components/ConfirmModal';
import { sendFeedbackEmail } from '../utils/emailTemplate';

interface FeedbackItem {
  id: string;
  created_at: string;
  essay_id: string;
  overall_score: number;
  grammar_issues: string[];
  strengths: string[];
  improvements: string[];
  suggested_feedback: string;
  essays: {
    title: string;
    content: string;
    created_at: string;
    students?: {
      name: string;
    } | null;
  };
}

function FeedbackHistory() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [minScore, setMinScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [studentNameFilter, setStudentNameFilter] = useState('');

  useEffect(() => {
    if (!user) return;

    const loadFeedback = async () => {
      setLoading(true);
      try {
        console.log('📋 Loading feedback history (non-join path) for user:', user.id);
        // Load essays first, then feedback, then students — avoids PostgREST embed 400s
        const { data: essays, error: essaysErr } = await supabase
          .from('essays')
          .select('id, title, content, created_at, student_id')
          .eq('teacher_id', user.id);

        if (essaysErr) {
          console.error('📋 Essays load error:', essaysErr);
          throw essaysErr;
        }

        const essayIds = (essays || []).map(e => e.id);
        if (essayIds.length === 0) {
          setFeedbackList([]);
          return;
        }

        const { data: fb, error: fbErr } = await supabase
          .from('feedback')
          .select('id, created_at, essay_id, overall_score, grammar_issues, strengths, improvements, suggested_feedback')
          .in('essay_id', essayIds)
          .order('created_at', { ascending: false });

        if (fbErr) {
          console.error('📋 Feedback load error:', fbErr);
          throw fbErr;
        }

        // Build map for essays
        const essayMap = new Map((essays || []).map((e: any) => [e.id, e]));

        // Load students if present
        const studentIds = Array.from(new Set((essays || []).map((e: any) => e.student_id).filter(Boolean)));
        let studentMap = new Map<string, string>();
        if (studentIds.length > 0) {
          const { data: students, error: studentsErr } = await supabase
            .from('students')
            .select('id, name')
            .in('id', studentIds);
          if (!studentsErr && students) {
            studentMap = new Map(students.map((s: any) => [s.id, s.name]));
          }
        }

        const transformed: FeedbackItem[] = (fb || []).map((f: any) => {
          const essay = essayMap.get(f.essay_id);
          const studentName = essay?.student_id ? studentMap.get(essay.student_id) || null : null;
          return {
            id: f.id,
            created_at: f.created_at,
            essay_id: f.essay_id,
            overall_score: f.overall_score,
            grammar_issues: f.grammar_issues || [],
            strengths: f.strengths || [],
            improvements: f.improvements || [],
            suggested_feedback: f.suggested_feedback || '',
            essays: {
              title: essay?.title || 'Untitled Essay',
              content: essay?.content || '',
              created_at: essay?.created_at || '',
              students: studentName ? { name: studentName } : null,
            },
          };
        });

        console.log('📋 Feedback history (non-join) loaded:', transformed.length, 'items');
        setFeedbackList(transformed);
      } catch (error) {
        console.error('❌ Failed to load feedback history:', error);
        notify.error('Failed to load feedback history');
      } finally {
        setLoading(false);
      }
    };

    loadFeedback();
  }, [user]);

  // Filter and sort feedback
  const filteredFeedback = feedbackList
    .filter(item => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          item.essays?.title?.toLowerCase().includes(query) ||
          item.suggested_feedback?.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // Score range filter
      if (minScore !== '' && item.overall_score < minScore) return false;
      if (maxScore !== '' && item.overall_score > maxScore) return false;

      // Date range filter
      if (startDate) {
        const itemDate = new Date(item.created_at);
        const filterStart = new Date(startDate);
        if (itemDate < filterStart) return false;
      }
      if (endDate) {
        const itemDate = new Date(item.created_at);
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999); // Include end of day
        if (itemDate > filterEnd) return false;
      }

      // Student name filter
      if (studentNameFilter) {
        const studentName = item.essays?.students?.name?.toLowerCase() || '';
        if (!studentName.includes(studentNameFilter.toLowerCase())) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.overall_score - a.overall_score;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const clearFilters = () => {
    setSearchQuery('');
    setMinScore('');
    setMaxScore('');
    setStartDate('');
    setEndDate('');
    setStudentNameFilter('');
  };

  const hasActiveFilters = searchQuery || minScore !== '' || maxScore !== '' || startDate || endDate || studentNameFilter;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFeedbackList(prev => prev.filter(item => item.id !== id));
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(null);
      }
      notify.success('Feedback deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      notify.error('Failed to delete feedback');
    }
  };

  const openDeleteModal = (id: string) => {
    setFeedbackToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedFeedback) return;

    const studentName = selectedFeedback.essays?.students?.name || 'Student';
    const studentEmail = `${studentName.toLowerCase().replace(/\s+/g, '.')}@example.com`; // Mock email

    setSendingEmail(true);
    try {
      const result = await sendFeedbackEmail({
        studentName,
        studentEmail,
        essayTitle: selectedFeedback.essays.title,
        overallScore: selectedFeedback.overall_score,
        strengths: selectedFeedback.strengths || [],
        improvements: selectedFeedback.improvements || [],
        grammarIssues: selectedFeedback.grammar_issues || [],
        suggestedFeedback: selectedFeedback.suggested_feedback,
        teacherName: user?.email || 'Your Teacher',
      });

      if (result.success) {
        notify.success(`Feedback email sent to ${studentName} (${studentEmail})`);
      } else {
        notify.error(result.error || 'Failed to send email');
      }
    } catch (error: any) {
      console.error('Email send error:', error);
      notify.error('Failed to send feedback email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setFeedbackToDelete(null);
        }}
        onConfirm={() => {
          if (feedbackToDelete) {
            handleDelete(feedbackToDelete);
          }
        }}
        title="Delete Feedback"
        message="Are you sure you want to delete this feedback? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Feedback History</h2>
            <p className="text-gray-600">View and manage all graded essays and their AI feedback</p>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label htmlFor="search" className="sr-only">Search feedback</label>
                <input
                  id="search"
                  type="text"
                  placeholder="Search by essay title or feedback..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="sort" className="sr-only">Sort by</label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'date' | 'score')}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="date">Sort by Date</option>
                  <option value="score">Sort by Score</option>
                </select>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                {showFilters ? '▲ Hide Filters' : '▼ Advanced Filters'}
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="minScore" className="block text-sm font-medium text-gray-700 mb-1">
                      Min Score
                    </label>
                    <input
                      id="minScore"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={minScore}
                      onChange={e => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxScore" className="block text-sm font-medium text-gray-700 mb-1">
                      Max Score
                    </label>
                    <input
                      id="maxScore"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="100"
                      value={maxScore}
                      onChange={e => setMaxScore(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-1">
                      Student Name
                    </label>
                    <input
                      id="studentName"
                      type="text"
                      placeholder="Filter by student name..."
                      value={studentNameFilter}
                      onChange={e => setStudentNameFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    {hasActiveFilters && (
                      <button
                        onClick={clearFilters}
                        className="w-full px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg font-medium transition-colors"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </div>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
                  <div className="space-y-4">
                    <div className="h-24 bg-gray-100 rounded"></div>
                    <div className="h-32 bg-gray-100 rounded"></div>
                    <div className="h-32 bg-gray-100 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {hasActiveFilters ? 'No matching feedback found' : 'No feedback history yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {hasActiveFilters
                  ? 'Try adjusting your search query or filters'
                  : 'Start grading essays to see feedback history here'}
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear All Filters
                </button>
              ) : (
                <Link
                  to="/essay-feedback"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Grade an Essay
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Feedback List */}
              <div className="lg:col-span-1 space-y-4">
                {filteredFeedback.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedFeedback(item)}
                    className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedFeedback?.id === item.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
                        {item.essays?.title || 'Untitled Essay'}
                      </h3>
                      <span className={`ml-2 px-2 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${getScoreColor(item.overall_score)}`}>
                        {item.overall_score}/100
                      </span>
                    </div>
                    {item.essays?.students?.name && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-medium">Student:</span> {item.essays.students.name}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mb-2">{formatDate(item.created_at)}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.suggested_feedback}</p>
                  </div>
                ))}
              </div>

              {/* Detailed View */}
              <div className="lg:col-span-2">
                {selectedFeedback ? (
                  <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">
                          {selectedFeedback.essays?.title || 'Untitled Essay'}
                        </h3>
                        {selectedFeedback.essays?.students?.name && (
                          <p className="text-sm text-gray-700 mb-1">
                            <span className="font-semibold">Student:</span> {selectedFeedback.essays.students.name}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Graded on {formatDate(selectedFeedback.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSendEmail}
                          disabled={sendingEmail}
                          className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Send feedback email"
                          title="Send feedback to student"
                        >
                          {sendingEmail ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => openDeleteModal(selectedFeedback.id)}
                          className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded transition-colors"
                          aria-label="Delete feedback"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Overall Score */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-700">Overall Score</span>
                        <span className="text-3xl font-bold text-blue-600">
                          {selectedFeedback.overall_score}/100
                        </span>
                      </div>
                    </div>

                    {/* Grammar Issues */}
                    {selectedFeedback.grammar_issues && selectedFeedback.grammar_issues.length > 0 && (
                      <div className="border-l-4 border-red-500 pl-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Grammar Issues</h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-700">
                          {selectedFeedback.grammar_issues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Strengths */}
                    {selectedFeedback.strengths && selectedFeedback.strengths.length > 0 && (
                      <div className="border-l-4 border-green-500 pl-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Strengths</h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-700">
                          {selectedFeedback.strengths.map((strength, idx) => (
                            <li key={idx}>{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {selectedFeedback.improvements && selectedFeedback.improvements.length > 0 && (
                      <div className="border-l-4 border-yellow-500 pl-4">
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Areas for Improvement</h4>
                        <ul className="list-disc pl-5 space-y-1 text-gray-700">
                          {selectedFeedback.improvements.map((improvement, idx) => (
                            <li key={idx}>{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Feedback */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative group">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-semibold text-gray-800">Suggested Feedback Summary</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedFeedback.suggested_feedback);
                            const btn = document.getElementById('copy-btn');
                            if (btn) {
                              const originalText = btn.innerHTML;
                              btn.innerHTML = '<span class="text-green-600 flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!</span>';
                              setTimeout(() => {
                                btn.innerHTML = originalText;
                              }, 2000);
                            }
                          }}
                          id="copy-btn"
                          className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy
                        </button>
                      </div>
                      <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                        {selectedFeedback.suggested_feedback}
                      </p>
                    </div>

                    {/* Essay Content */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-gray-800 mb-2">Original Essay</h4>
                      <div className="max-h-96 overflow-y-auto">
                        <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                          {selectedFeedback.essays?.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <div className="text-6xl mb-4">👈</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Feedback to View</h3>
                    <p className="text-gray-600">Click on any feedback item to see details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
        </ErrorBoundary>
    </>
  );
}

export default FeedbackHistory;
