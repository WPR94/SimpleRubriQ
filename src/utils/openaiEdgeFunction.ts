import { supabase } from '../lib/supabaseClient';

/**
 * Call the Supabase Edge Function to generate essay feedback
 * This keeps the API key on the server-side for security
 */
export async function generateFeedbackViaEdgeFunction(
  essay: string,
  rubricCriteria: string,
  customPrompt?: string
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-feedback', {
      body: {
        essay,
        rubricCriteria,
        customPrompt,
        type: 'feedback',
      },
    });

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data?.feedback) {
      throw new Error('No feedback returned from edge function');
    }

    return data.feedback;
  } catch (error) {
    console.error('❌ Edge Function Feedback Error:', error);
    throw error;
  }
}

/**
 * Call the Supabase Edge Function to generate essay score
 */
export async function generateScoreViaEdgeFunction(
  essay: string,
  rubricCriteria: string
): Promise<number> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-feedback', {
      body: {
        essay,
        rubricCriteria,
        type: 'score',
      },
    });

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    const score = data?.score;
    if (typeof score !== 'number' || score < 0 || score > 100) {
      throw new Error('Invalid score returned from edge function');
    }

    return score;
  } catch (error) {
    console.error('❌ Edge Function Score Error:', error);
    throw error;
  }
}

/**
 * Generate both feedback and score in parallel
 */
export async function generateBothViaEdgeFunction(
  essay: string,
  rubricCriteria: string
): Promise<{ feedback: string; score: number }> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-feedback', {
      body: {
        essay,
        rubricCriteria,
        type: 'both',
      },
    });

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data?.feedback || typeof data?.score !== 'number') {
      throw new Error('Invalid response from edge function');
    }

    return {
      feedback: data.feedback,
      score: data.score,
    };
  } catch (error) {
    console.error('❌ Edge Function Error:', error);
    throw error;
  }
}
