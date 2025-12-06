// Supabase Edge Function: generate-feedback
// Set your secrets with: supabase secrets set OPENAI_API_KEY=sk-proj-...
// Deploy with: supabase functions deploy generate-feedback

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CriteriaMatch = { criterion: string; examples: string[] };
type AiFeedback = {
  grammar_issues: string[];
  strengths: string[];
  improvements: string[];
  criteria_matches: CriteriaMatch[];
  suggested_feedback: string;
  overall_score: number;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Verify JWT authentication
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const { essay, rubricCriteria, type, customPrompt } = (body as { 
    essay?: string
    rubricCriteria?: string
    type?: 'feedback' | 'score' | 'both'
    customPrompt?: string
  }) ?? {};

  if (typeof essay !== "string" || typeof rubricCriteria !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing 'essay' or 'rubricCriteria'" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Basic input size validation (prevent abuse)
  const MAX_ESSAY_LENGTH = 50000; // ~10k words
  
  if (essay.length > MAX_ESSAY_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Essay too long (max ${MAX_ESSAY_LENGTH} characters)` }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing OPENAI_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const requestType = type || 'both';

  // Helper to call OpenAI chat completions
  async function generateFeedback(): Promise<string> {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: `You are an expert educator providing constructive feedback on student essays. 
            Be specific, encouraging, and actionable. Format your feedback clearly with sections for:
            - Strengths (what the student did well)
            - Areas for Improvement (constructive suggestions)
            - Action Steps (concrete next steps)
            
            ${customPrompt ? `ADDITIONAL INSTRUCTION: ${customPrompt}` : ''}` 
          },
          {
            role: "user",
            content: `Please grade and provide feedback on this essay using the following rubric:
            
            RUBRIC:
            ${rubricCriteria}
            
            ESSAY:
            ${essay}
            
            Provide detailed, helpful feedback that follows the rubric.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI API error (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from OpenAI");
    return content;
  }

  async function generateScore(): Promise<number> {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert educator. Return ONLY a number between 0-100 representing the essay score based on the rubric.
            Do not include any other text, just the number.`,
          },
          {
            role: "user",
            content: `Score this essay on a scale of 0-100 using this rubric:
            
            RUBRIC:
            ${rubricCriteria}
            
            ESSAY:
            ${essay}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 10,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI API error (${resp.status}): ${text}`);
    }

    const data = await resp.json();
    const scoreText = data?.choices?.[0]?.message?.content?.trim();
    const score = parseInt(scoreText || '0', 10);
    
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error('Invalid score returned');
    }
    return score;
  }

  try {
    const result: any = {};

    if (requestType === 'feedback' || requestType === 'both') {
      result.feedback = await generateFeedback();
    }

    if (requestType === 'score' || requestType === 'both') {
      result.score = await generateScore();
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("generate-feedback error", err);
    return new Response(
      JSON.stringify({ error: `Failed to generate: ${err instanceof Error ? err.message : 'Unknown error'}` }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
