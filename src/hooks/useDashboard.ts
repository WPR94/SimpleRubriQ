import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type DashboardStats = {
  essaysCount: number;
  rubricsCount: number;
  feedbackCount: number;
};

type RecentFeedback = {
  id: number;
  created_at: string;
  essay_title: string;
};

type FeedbackData = {
  created_at: string;
  overall_score: number;
  strengths?: string[];
  improvements?: string[];
};

async function fetchDashboardStats(userId: string): Promise<{ stats: DashboardStats; recentFeedback: RecentFeedback[] }> {
  try {
    // Try RPC first for consolidated query
    const { data, error } = await supabase.rpc('get_teacher_dashboard', { p_teacher_id: userId });
    if (!error && data && Array.isArray(data) && data.length > 0) {
      const row: any = data[0];
      const stats = {
        essaysCount: Number(row.essays_count) || 0,
        rubricsCount: Number(row.rubrics_count) || 0,
        feedbackCount: Number(row.feedback_count) || 0,
      };
      const recentArray: any[] = Array.isArray(row.recent) ? row.recent : [];
      const recentFeedback: RecentFeedback[] = recentArray.map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        essay_title: r.essay_title || 'Untitled Essay',
      }));
      return { stats, recentFeedback };
    }
  } catch (e) {
    console.log('[useDashboard] RPC failed, using fallback queries');
  }

  // Fallback: individual queries
  const [essaysResult, rubricsResult, feedbackResult, recentResult] = await Promise.all([
    supabase.from('essays').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
    supabase.from('rubrics').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
    supabase.from('feedback').select('id, essays!inner(id,teacher_id)', { count: 'exact', head: true }).eq('essays.teacher_id', userId),
    supabase.from('feedback').select('id, created_at, essays!inner(title,teacher_id)').eq('essays.teacher_id', userId).order('created_at', { ascending: false }).limit(5),
  ]);

  if (essaysResult.error) throw essaysResult.error;
  if (rubricsResult.error) throw rubricsResult.error;
  if (feedbackResult.error) throw feedbackResult.error;
  if (recentResult.error) throw recentResult.error;

  const stats = {
    essaysCount: essaysResult.count ?? 0,
    rubricsCount: rubricsResult.count ?? 0,
    feedbackCount: feedbackResult.count ?? 0,
  };

  const recentFeedback = (recentResult.data ?? []).map((item: any) => ({
    id: item.id,
    created_at: item.created_at,
    essay_title: item.essays?.title || 'Untitled Essay',
  }));

  return { stats, recentFeedback };
}

async function fetchFeedbackData(userId: string): Promise<FeedbackData[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('created_at, overall_score, strengths, improvements, essays!inner(teacher_id)')
    .eq('essays.teacher_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return data || [];
}

export function useDashboardStats(): UseQueryResult<{ stats: DashboardStats; recentFeedback: RecentFeedback[] }, Error> {
  const { user } = useAuth();
  return useQuery(
    ['dashboard', 'stats', user?.id],
    () => fetchDashboardStats(user!.id),
    {
      enabled: !!user,
      staleTime: 60_000, // Consider fresh for 1 minute
      cacheTime: 5 * 60_000, // Keep in cache for 5 minutes (v4 uses cacheTime not gcTime)
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );
}

export function useFeedbackData(): UseQueryResult<FeedbackData[], Error> {
  const { user } = useAuth();
  return useQuery(
    ['dashboard', 'feedback', user?.id],
    () => fetchFeedbackData(user!.id),
    {
      enabled: !!user,
      staleTime: 60_000,
      cacheTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );
}
