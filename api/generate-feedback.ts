import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI with server-side key (secure)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // No VITE_ prefix for server-side
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'API key not configured. Please add OPENAI_API_KEY to environment variables.' });
    }

    const { essayText, rubricCriteria, examBoard, customPrompt } = req.body;

    if (!essayText || !rubricCriteria) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an experienced GCSE English teacher and examiner${examBoard ? ` for ${examBoard}` : ''}. Provide warm, authentic feedback as if speaking face-to-face with your student.

${customPrompt ? `TEACHER INSTRUCTION: ${customPrompt}\n` : ''}

🛡️ SAFEGUARDING PROTOCOL:
If the student's work contains explicit mentions or strong indicators of self-harm, abuse, severe violence, or radicalization:
1. Start your response with "⚠️ SAFEGUARDING ALERT: This work contains concerning themes. Please review in accordance with your school's safeguarding policy."
2. Proceed with the academic assessment as normal, but maintain a neutral, professional tone.

📋 YOUR TASK:
1. Assess against GCSE Assessment Objectives (AO1-AO4 where applicable)
2. Assign band levels (1=emerging, 2-3=developing, 4-5=secure, 6=exceptional)
3. Quote specific evidence from their writing
5. Provide a JSON object with breakdown scores for each rubric criterion (0-100)

✨ TONE:
- Encouraging yet honest - celebrate wins, be constructive about gaps
- Specific over generic ("Your metaphor 'time is a thief' creates..." not "Good imagery")
- Natural speech patterns ("I really liked..." "Have you considered..." "One thing to work on...")
- Avoid: "overall", "in conclusion", "the student demonstrates", robotic lists

🎯 ASSESSMENT OBJECTIVES (adapt to rubric):
- AO1: Ideas, themes, purpose
- AO2: Language, structure, form techniques
- AO3: Context (if relevant)
- AO4: SPaG (spelling, punctuation, grammar)

📊 BAND DESCRIPTORS:
Band 6 (90-100%): Perceptive, sophisticated, compelling
Band 5 (75-89%): Clear, effective, well-developed
Band 4 (60-74%): Explained, some development, generally clear
Band 3 (45-59%): Attempts made, simple ideas, basic clarity
Band 2 (30-44%): Limited, unclear, minimal development
Band 1 (0-29%): Very limited, unclear purpose`,
        },
        {
          role: 'user',
          content: `Assess this essay using GCSE standards. Provide detailed analysis.

📋 RUBRIC:
${rubricCriteria}

📝 ESSAY:
${essayText}

💬 Provide:
1. 2-3 specific strengths with quotes
2. 2-3 development areas with examples
3. Grammar/SPaG issues if significant
4. Natural summary (300-400 words max)
5. A JSON object named "criteria_scores" mapping rubric categories to scores (0-100)

Be specific. Quote their work. Sound like a real teacher, not a robot.`,
        },
      ],
      temperature: 0.85,
      max_tokens: 1000,
      response_format: { type: "json_object" } // Force JSON output for easier parsing
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No feedback generated');
    }
    
    // Parse the JSON response
    const parsedContent = JSON.parse(content);
    
    // Add diagnostics header (non-sensitive)
    const key = process.env.OPENAI_API_KEY || '';
    res.setHeader('X-Diagnostics', `openaiKeyPresent=${!!key};keyStart=${key.slice(0,8)}`);
    return res.status(200).json({ feedback: parsedContent });
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    
    if (error?.status === 401) {
      return res.status(401).json({ error: 'OpenAI API authentication failed' });
    }
    if (error?.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    const key = process.env.OPENAI_API_KEY || '';
    res.setHeader('X-Diagnostics', `openaiKeyPresent=${!!key};keyStart=${key.slice(0,8)}`);
    return res.status(500).json({
      error: error?.message || 'Failed to generate feedback'
    });
  }
}
