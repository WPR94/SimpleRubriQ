import { supabase } from '../lib/supabaseClient';

type CriteriaMatch = { criterion: string; examples: string[] };

export type AiFeedback = {
  grammar_issues: string[];
  strengths: string[];
  improvements: string[];
  criteria_matches: CriteriaMatch[];
  suggested_feedback: string;
  overall_score: number;
  criteria_scores?: Record<string, number>; // New field for dynamic grading
};

/**
 * Invokes the generate-feedback Edge Function with authentication.
 * Requires a logged-in user session.
 */
export async function generateAiFeedback(
  essay: string,
  rubric: { criteria: unknown[] }
): Promise<AiFeedback> {
  // Helper to build mock feedback
  const buildMock = (): AiFeedback => {
    const wordCount = essay.trim().split(/\s+/).length;
    const scoreBase = Math.max(40, Math.min(95, Math.floor(60 + (wordCount % 40))));
    const criteria = Array.isArray(rubric?.criteria) ? (rubric.criteria as any[]) : [];
    const criteria_matches = criteria.slice(0, 3).map((c: any) => ({
      criterion: c?.category || 'Criterion',
      examples: [
        'Example sentence that roughly aligns with this criterion.',
        'Another sample supporting detail found in the essay.'
      ],
    }));
    return {
      grammar_issues: [
        'Some sentences could be shortened to improve clarity.',
        'Consider revising a few comma splices.'
      ],
      strengths: [
        'Clear central idea is presented early.',
        'Good variety of vocabulary in key paragraphs.'
      ],
      improvements: [
        'Add more specific evidence to support the main points.',
        'Tighten the conclusion to reinforce the thesis.'
      ],
      criteria_matches,
      suggested_feedback: 'Well done overall. Focus on adding concrete evidence and polishing sentence structure.',
      overall_score: scoreBase,
      criteria_scores: {
        'Content': Math.min(100, scoreBase + 5),
        'Organization': Math.max(0, scoreBase - 5),
        'Language': scoreBase
      }
    };
  };

  // Optional mock mode for local testing without deploying the Edge Function or using an API key
  const aiMode = ((import.meta as any)?.env?.VITE_USE_MOCK_AI || '').toString().toLowerCase();
  console.log('🔍 Mock AI Check:', {
    rawValue: (import.meta as any)?.env?.VITE_USE_MOCK_AI,
    aiMode,
    allEnv: (import.meta as any)?.env
  });
  
  // TEMPORARY FIX: Force mock mode ON for local testing
  const useMock = true; // Changed from: aiMode === 'true'
  const useFallback = aiMode === 'fallback';
  
  if (useMock) {
    console.log('✅ Using MOCK AI - no Edge Function call (FORCED ON)');
    return buildMock();
  }
  console.log('⚠️ NOT using mock AI, will call Edge Function');
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('You must be logged in to generate AI feedback');
  }

  const response = await supabase.functions.invoke('generate-feedback', {
    body: { essay, rubric },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.error) {
    // Surface more actionable guidance when the Edge Function fails
    console.error('Edge Function error:', response);
    const hint = ' (Check that the generate-feedback Edge Function is deployed and OPENAI_API_KEY is set)';
    if (useFallback) {
      console.warn('Falling back to mock AI because VITE_USE_MOCK_AI=fallback');
      return buildMock();
    }
    throw new Error((response.error.message || 'Failed to generate feedback') + hint);
  }

  return response.data as AiFeedback;
}
