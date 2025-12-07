import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient'; // for saving essays/feedback
import notify from '../utils/notify';
import { parseEssayFile, validateEssay } from '../utils/essayParser';
import { generateEssayFeedback, generateEssayScore, generateBandAnalysis } from '../utils/openaiClient';
import { generateFeedbackViaEdgeFunction, generateScoreViaEdgeFunction } from '../utils/openaiEdgeFunction';
import { AiFeedback } from '../utils/edgeFunctions';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import { FormSkeleton } from '../components/LoadingSkeleton';
// Heavy export libs will be lazy-loaded when needed
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '../hooks/useKeyboardShortcuts';
import CommentBank from '../components/CommentBank';
import { useTeacherRubrics, useTeacherStudents } from '../hooks/useTeacherData';

type FeedbackTone = 'encouraging' | 'strict' | 'concise' | 'socratic';

// Helper to create a simple text highlight based on keyword matching
function highlightEssayText(text: string, feedback: AiFeedback | null): React.ReactNode[] {
  if (!feedback) {
    return [<span key={0}>{text}</span>];
  }

  // Extract keywords from feedback for highlighting
  const sentences = text.split(/([.!?]\s+)/);
  
  return sentences.map((sentence, idx) => {
    const lowerSentence = sentence.toLowerCase();
    
    // Check for grammar issues (red highlight)
    const hasGrammarIssue = feedback.grammar_issues.some(issue => {
      const keywords = issue.toLowerCase().match(/\b\w{4,}\b/g) || [];
      return keywords.some(kw => lowerSentence.includes(kw));
    });
    
    // Check for strengths (green highlight)
    const hasStrength = feedback.strengths.some(strength => {
      const keywords = strength.toLowerCase().match(/\b\w{4,}\b/g) || [];
      return keywords.some(kw => lowerSentence.includes(kw));
    });
    
    // Check for criterion matches (purple highlight)
    const hasCriterion = feedback.criteria_matches?.some(match => {
      return match.examples.some(example => {
        const keywords = example.toLowerCase().match(/\b\w{4,}\b/g) || [];
        return keywords.some(kw => lowerSentence.includes(kw));
      });
    });
    
    // Apply highlight based on priority: grammar > criterion > strength
    if (hasGrammarIssue && sentence.trim().length > 10) {
      return (
        <span key={idx} className="bg-red-100 border-b-2 border-red-400 px-1" title="Grammar Issue">
          {sentence}
        </span>
      );
    } else if (hasCriterion && sentence.trim().length > 10) {
      return (
        <span key={idx} className="bg-purple-100 border-b-2 border-purple-400 px-1" title="Rubric Criterion Match">
          {sentence}
        </span>
      );
    } else if (hasStrength && sentence.trim().length > 10) {
      return (
        <span key={idx} className="bg-green-100 border-b-2 border-green-400 px-1" title="Strength">
          {sentence}
        </span>
      );
    }
    
    return <span key={idx}>{sentence}</span>;
  });
}

function EssayFeedback() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [rubricId, setRubricId] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('Please provide detailed, constructive feedback for this essay based on the rubric criteria.');
  const [selectedTone, setSelectedTone] = useState<FeedbackTone>('encouraging');
  const { data: rubrics = [], isLoading: rubricsLoading } = useTeacherRubrics();
  const { data: students = [], isLoading: studentsLoading } = useTeacherStudents();
  const [bandAnalysis, setBandAnalysis] = useState<any>(null);
  const [feedback, setFeedback] = useState<AiFeedback | null>(null);
  const [savedEssayId, setSavedEssayId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showCommentBank, setShowCommentBank] = useState(false);
  const [showAoLegend, setShowAoLegend] = useState(false);
  const initialLoading = rubricsLoading || studentsLoading;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    
    try {
      const text = await parseEssayFile(file, (progress) => {
        setUploadProgress(progress);
      });
      
      setContent(text);
      
      // Auto-fill title from filename if not set
      if (!title) {
        const baseName = file.name.replace(/\.(txt|docx|pdf)$/i, '');
        setTitle(baseName);
      }
      
      notify.success(`Essay loaded from ${file.name}`);
    } catch (error) {
      console.error('File upload error:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to parse essay file');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const text = await parseEssayFile(imgFile, (progress) => {
        setUploadProgress(progress);
      });
      
      setContent(text);
      notify.success('Essay scanned successfully');
    } catch (error) {
      console.error('Scan error:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to scan essay');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (scanInputRef.current) {
        scanInputRef.current.value = '';
      }
    }
  };

  const handleGenerate = async () => {
    // Validate essay
    const validation = validateEssay(content);
    if (!validation.valid) {
      notify.error(validation.error || 'Invalid essay');
      return;
    }
    
    if (!title.trim()) {
      notify.error('Please enter an essay title');
      return;
    }
    
    if (!user) {
      notify.error('Please sign in to generate AI feedback');
      return;
    }
    
    if (!rubricId) {
      notify.error('Please select a rubric');
      return;
    }
    
    setGenerating(true);
    
    try {
      // Get rubric details
      const { data: rubricData, error: rubricError } = await supabase
        .from('rubrics')
        .select('criteria, name')
        .eq('id', rubricId)
        .single();
      
      if (rubricError || !rubricData) {
        throw new Error('Failed to load rubric');
      }
      
      // Prepare rubric criteria string for OpenAI
      const rubricCriteria = Array.isArray(rubricData.criteria)
        ? rubricData.criteria.join('\n')
        : typeof rubricData.criteria === 'string'
        ? rubricData.criteria
        : JSON.stringify(rubricData.criteria);
      
      notify.info('Generating AI feedback... please wait');
      
      // Get selected rubric's exam board for GCSE-specific feedback
      const selectedRubric = rubrics.find(r => r.id === rubricId);
      const examBoard = selectedRubric?.exam_board;
      
      // Construct full prompt with tone
      const toneInstructions = {
        encouraging: "Use a warm, growth-mindset tone. Focus on effort and future improvement. Use phrases like 'I love how you...' or 'Next time, try...'.",
        strict: "Use a formal, academic tone. Be direct about errors. Focus on rigorous adherence to the rubric.",
        concise: "Be extremely brief. Bullet points only. No fluff. Focus strictly on actionable changes.",
        socratic: "Ask questions instead of giving answers. Guide the student to find their own mistakes."
      };

      const fullPrompt = `
        ${customPrompt ? `Teacher Instructions: ${customPrompt}` : ''}
        
        Tone of Voice: ${toneInstructions[selectedTone]}
      `;

      // Try edge function first (secure server-side), fallback to enhanced client-side
      let feedbackText: string;
      let score: number;
      let bandData: any = null;
      
      try {
        // Attempt to use Edge Function (most secure)
        console.log('📡 Trying Edge Function for feedback generation...');
        feedbackText = await generateFeedbackViaEdgeFunction(content, rubricCriteria, fullPrompt);
        score = await generateScoreViaEdgeFunction(content, rubricCriteria);
        console.log('✅ Using Edge Function - API key safely on server');
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function failed, falling back to enhanced client-side OpenAI:', edgeFunctionError);
        // Fallback to enhanced client-side OpenAI with GCSE analysis
        feedbackText = await generateEssayFeedback(content, rubricCriteria, examBoard, fullPrompt);
        score = await generateEssayScore(content, rubricCriteria);
        
        // Get detailed band analysis if GCSE rubric
        try {
          bandData = await generateBandAnalysis(content, rubricCriteria, examBoard);
          setBandAnalysis(bandData);
          console.log('✅ GCSE Band Analysis:', bandData);
        } catch (bandError) {
          console.warn('⚠️ Band analysis failed (non-critical):', bandError);
        }
        
        console.log('✅ Using Enhanced Client-side OpenAI API with GCSE analysis');
      }
      
      // Parse feedback text into structured format and ignore any trailing JSON blocks
      const parseFeedbackText = (text: string) => {
        // Capture optional fenced JSON (e.g., AO scores) so we can store without breaking parsing
        const jsonBlock = text.match(/```json\s*([\s\S]*?)```/i);
        let criteriaScores: Record<string, number> | undefined;
        if (jsonBlock?.[1]) {
          try {
            const parsedJson = JSON.parse(jsonBlock[1]);
            if (parsedJson && typeof parsedJson === 'object') {
              criteriaScores = parsedJson as Record<string, number>;
            }
          } catch {
            // Ignore bad JSON from the model
          }
        }

        // Remove the JSON block from the main text for cleaner section parsing
        const sanitized = text.replace(/```json[\s\S]*?```/gi, '');

        const sections = {
          strengths: [] as string[],
          improvements: [] as string[],
          grammar_issues: [] as string[],
        };
        
        // Split into main sections - look for common patterns
        const strengthsMatch = sanitized.match(/Strengths:(.*?)(?=Areas for Improvement:|$)/is);
        const improvementsMatch = sanitized.match(/Areas for Improvement:(.*?)(?=Action Steps:|Suggested Feedback:|$)/is);
        const grammarMatch = sanitized.match(/grammar issues?:(.*?)(?=Strengths:|Areas for Improvement:|$)/is);
        
        if (strengthsMatch) {
          sections.strengths = strengthsMatch[1]
            .split(/[\-•*]|\d+\./)
            .filter(s => s.trim())
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
        
        if (improvementsMatch) {
          sections.improvements = improvementsMatch[1]
            .split(/[\-•*]|\d+\./)
            .filter(s => s.trim())
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
        
        if (grammarMatch) {
          sections.grammar_issues = grammarMatch[1]
            .split(/[\-•*]|\d+\./)
            .filter(s => s.trim())
            .map(s => s.trim())
            .filter(s => s.length > 0);
        }
        
        const cleanedFeedback = sanitized.trim();
        return { sections, criteriaScores, cleanedFeedback };
      };
      
      const { sections: parsedSections, criteriaScores, cleanedFeedback } = parseFeedbackText(feedbackText);

      // Derive a more human-feeling score: prefer explicit criteria/AO scores if present, otherwise fall back to model score
      const computeHumanScore = () => {
        if (criteriaScores && Object.keys(criteriaScores).length > 0) {
          const values = Object.values(criteriaScores).map(Number).filter(v => !Number.isNaN(v));
          if (values.length) return values.reduce((a, b) => a + b, 0) / values.length;
        }
        if (bandAnalysis?.overall_score) return bandAnalysis.overall_score;
        return score;
      };

      const humanScore = Math.min(100, Math.max(0, computeHumanScore()));
      
      const aiFeedback: AiFeedback = {
        overall_score: humanScore,
        grammar_issues: parsedSections.grammar_issues.length > 0 ? parsedSections.grammar_issues : ['No significant grammar issues found'],
        strengths: parsedSections.strengths.length > 0 ? parsedSections.strengths : ['Well-structured and coherent essay'],
        improvements: parsedSections.improvements.length > 0 ? parsedSections.improvements : ['Continue to develop and refine writing skills'],
        suggested_feedback: cleanedFeedback || feedbackText,
        criteria_matches: [],
        ...(criteriaScores ? { criteria_scores: criteriaScores } : {}),
      };
      
      setFeedback(aiFeedback);
      
      // Save essay and feedback to database
      console.log('💾 Saving essay to database...', {
        title,
        word_count: validation.wordCount,
        teacher_id: user.id,
        rubric_id: rubricId,
        student_id: studentId || null,
        content_length: content.length
      });
      const { data: essayData, error: essayError } = await supabase
        .from('essays')
        .insert([{
          title,
          content,
          word_count: validation.wordCount,
          teacher_id: user.id,
          rubric_id: rubricId,
          student_id: studentId || null,
        }])
        .select('id')
        .single();
      
      console.log('💾 Essay save result:', { essayData, essayError });
      
      if (essayError) {
        console.error('❌ Failed to save essay - Full error:', JSON.stringify(essayError, null, 2));
        notify.error(`Failed to save essay: ${essayError.message || 'Unknown error'}`);
        return;
      }
      
      if (!essayData) {
        console.error('❌ No essay data returned after insert');
        notify.error('Feedback generated but failed to save to database');
        return;
      }
      
      
      // Save feedback to database
      setSavedEssayId(essayData.id);
      console.log('💾 Saving feedback to database...', {
        essay_id: essayData.id,
        rubric_id: rubricId,
        overall_score: aiFeedback.overall_score
      });
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .insert([{
          essay_id: essayData.id,
          rubric_id: rubricId,
          grammar_issues: aiFeedback.grammar_issues,
          strengths: aiFeedback.strengths,
          improvements: aiFeedback.improvements,
          suggested_feedback: aiFeedback.suggested_feedback,
          // DB expects an integer; round the human-friendly score
          overall_score: Math.round(aiFeedback.overall_score),
        }])
        .select('id')
        .single();
      
      console.log('💾 Feedback save result:', { feedbackData, feedbackError });
      
      if (feedbackError) {
        console.error('❌ Failed to save feedback - Full error:', JSON.stringify(feedbackError, null, 2));
        notify.error(`Essay saved but feedback failed to save: ${feedbackError.message || 'Unknown error'}`);
      } else {
        console.log('✅ Essay and feedback saved successfully!');
        notify.success('AI feedback generated and saved successfully!');
        
        // Auto-scroll to feedback section
        setTimeout(() => {
          feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (error) {
      console.error('❌ Generate error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error details:', { errorMessage, fullError: error });
      notify.error(errorMessage || 'Failed to generate feedback');
    } finally {
      setGenerating(false);
    }
  };

  const handleDone = () => {
    // Clear state and scroll to top for new feedback
    setFeedback(null);
    setSavedEssayId(null);
    setBandAnalysis(null);
    setTitle('');
    setContent('');
    setRubricId('');
    setStudentId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify.success('Ready to grade another essay!');
  };

  const handleExportText = async () => {
    if (!feedback) return;
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;
      let yPosition = 20;
      
      // Helper to add text with wrapping
      const addText = (text: string, fontSize = 10, isBold = false) => {
        doc.setFontSize(fontSize);
        if (isBold) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += fontSize * 0.5;
        });
        yPosition += 3;
      };
      
      // Title
      addText('ESSAY FEEDBACK REPORT', 16, true);
      yPosition += 2;
      addText(`Essay: ${title}`, 12, true);
      addText(`Date: ${new Date().toLocaleDateString()}`, 10);
      addText(`Overall Score: ${feedback.overall_score}/100`, 12, true);
      
      // Band Analysis in PDF
      if (bandAnalysis) {
        addText(`GCSE Band: ${bandAnalysis.overall_band}/6 (${
          bandAnalysis.overall_band === 6 ? 'Exceptional' :
          bandAnalysis.overall_band === 5 ? 'Secure' :
          bandAnalysis.overall_band === 4 ? 'Developing' :
          bandAnalysis.overall_band === 3 ? 'Emerging' :
          bandAnalysis.overall_band === 2 ? 'Limited' : 'Basic'
        })`, 11, true);
        if (bandAnalysis.justification) {
          addText(`"${bandAnalysis.justification}"`, 9);
        }
      }
      yPosition += 5;
      
      // Assessment Objectives Analysis
      if (bandAnalysis?.ao_bands && bandAnalysis.ao_bands.length > 0) {
        addText('ASSESSMENT OBJECTIVES ANALYSIS', 12, true);
        bandAnalysis.ao_bands.forEach((ao: any) => {
          addText(`${ao.ao} - Band ${ao.band}: ${ao.comment}`, 10);
        });
        yPosition += 5;
      }

      // AO Legend (if toggled on)
      if (showAoLegend) {
        addText('ASSESSMENT OBJECTIVES GUIDE', 12, true);
        addText('AO1: Content and Organisation - Identify and interpret information, select evidence, communicate clearly', 9);
        addText('AO2: Language, Structure and Form - Analyse how writers use language and structure to achieve effects', 9);
        addText('AO3: Context - Show understanding of relationships between texts and contexts', 9);
        addText('AO4: SPaG - Use accurate spelling, punctuation, grammar, and varied vocabulary', 9);
        yPosition += 5;
      }
      
      // Grammar Issues
      addText('GRAMMAR ISSUES', 12, true);
      feedback.grammar_issues.forEach((issue, i) => {
        addText(`${i + 1}. ${issue}`, 10);
      });
      yPosition += 5;
      
      // Strengths
      addText('STRENGTHS', 12, true);
      feedback.strengths.forEach((strength, i) => {
        addText(`${i + 1}. ${strength}`, 10);
      });
      yPosition += 5;
      
      // Improvements
      addText('AREAS FOR IMPROVEMENT', 12, true);
      feedback.improvements.forEach((improvement, i) => {
        addText(`${i + 1}. ${improvement}`, 10);
      });
      yPosition += 5;
      
      // Criteria Matches
      if (feedback.criteria_matches && feedback.criteria_matches.length > 0) {
        addText('RUBRIC CRITERIA ANALYSIS', 12, true);
        feedback.criteria_matches.forEach((match) => {
          addText(match.criterion, 11, true);
          match.examples.forEach((example) => {
            addText(`• ${example}`, 10);
          });
          yPosition += 2;
        });
        yPosition += 5;
      }
      
      // Suggested Feedback
      addText('SUGGESTED FEEDBACK SUMMARY', 12, true);
      addText(feedback.suggested_feedback, 10);
      yPosition += 5;
      
      // Essay Content
      addText('ESSAY CONTENT', 12, true);
      addText(content, 9);
    
      // Save PDF
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}_feedback.pdf`);
      notify.success('Feedback exported as PDF!');
    } catch (error) {
      console.error('PDF export error:', error);
      notify.error('Failed to export PDF');
    }
  };

  const handlePrint = () => {
    if (!feedback) return;
    window.print();
  };

  const handleInsertComment = (text: string, target: 'strengths' | 'improvements' | 'grammar_issues' = 'improvements') => {
    if (!feedback) return;
    const updated: AiFeedback = { ...feedback };
    if (target === 'strengths') updated.strengths = [...(feedback.strengths || []), text];
    if (target === 'improvements') updated.improvements = [...(feedback.improvements || []), text];
    if (target === 'grammar_issues') updated.grammar_issues = [...(feedback.grammar_issues || []), text];
    setFeedback(updated);
    notify.success('Comment inserted');
  };

  const handleExportDocx = async () => {
    if (!feedback) return;
    try {
      const docx = await import('docx');
      const paragraphs: InstanceType<typeof docx.Paragraph>[] = [];
      const pushHeading = (text: string, level: any = docx.HeadingLevel.HEADING_2) => {
        paragraphs.push(new docx.Paragraph({ text, heading: level }));
      };
      const pushText = (text: string) => {
        paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(text)] }));
      };

      pushHeading('Essay Feedback Report', docx.HeadingLevel.HEADING_1);
      pushText(`Essay Title: ${title}`);
      pushText(`Date: ${new Date().toLocaleDateString()}`);
      pushText(`Overall Score: ${feedback.overall_score}/100`);

      pushHeading('Grammar Issues');
      feedback.grammar_issues.forEach((s, i) => pushText(`${i + 1}. ${s}`));

      pushHeading('Strengths');
      feedback.strengths.forEach((s, i) => pushText(`${i + 1}. ${s}`));

      pushHeading('Areas for Improvement');
      feedback.improvements.forEach((s, i) => pushText(`${i + 1}. ${s}`));

      if (feedback.criteria_matches && feedback.criteria_matches.length > 0) {
        pushHeading('Rubric Criteria Analysis');
        feedback.criteria_matches.forEach((m) => {
          paragraphs.push(new docx.Paragraph({ text: m.criterion, heading: docx.HeadingLevel.HEADING_3 }));
          m.examples.forEach((ex) => pushText(`• ${ex}`));
        });
      }

      pushHeading('Suggested Feedback Summary');
      pushText(feedback.suggested_feedback);

      pushHeading('Essay Content');
      feedback.suggested_feedback.split('\n').forEach((line) => pushText(line));
      pushText(content);

      const theDoc = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
      const blob = await docx.Packer.toBlob(theDoc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_feedback.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success('Feedback exported as DOCX!');
    } catch (err) {
      console.error('DOCX export error:', err);
      notify.error('Failed to export DOCX');
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'Enter', ctrl: true, callback: () => handleGenerate(), description: 'Generate AI feedback' },
    { key: 'p', ctrl: true, shift: true, callback: () => handleExportText(), description: 'Export PDF' },
    { key: 'd', ctrl: true, shift: true, callback: () => handleExportDocx(), description: 'Export DOCX' },
    { key: '?', shift: true, callback: () => setShortcutsOpen((v) => !v), description: 'Toggle shortcuts help' },
    { key: 'ArrowUp', ctrl: true, callback: () => {
        if (!feedback) return;
        setFeedback({ ...feedback, overall_score: Math.min(100, feedback.overall_score + 1) });
      }, description: 'Increase score +1' },
    { key: 'ArrowDown', ctrl: true, callback: () => {
        if (!feedback) return;
        setFeedback({ ...feedback, overall_score: Math.max(0, feedback.overall_score - 1) });
      }, description: 'Decrease score -1' },
  ]);

  const highlightedEssay = useMemo(() => highlightEssayText(content, feedback), [content, feedback]);

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900">Essay Feedback Generator</h2>
        {initialLoading ? (
          <div className="space-y-4">
            <FormSkeleton />
            <FormSkeleton />
          </div>
        ) : (
        <>
        {/* Tone Selector */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Feedback Tone
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['encouraging', 'strict', 'concise', 'socratic'] as FeedbackTone[]).map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => setSelectedTone(tone)}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium capitalize transition-all
                  ${selectedTone === tone 
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}
                `}
              >
                {tone}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {selectedTone === 'encouraging' && "Warm and supportive, focusing on growth."}
            {selectedTone === 'strict' && "Formal and objective, focusing on standards."}
            {selectedTone === 'concise' && "Short, bulleted, and to the point."}
            {selectedTone === 'socratic' && "Asks guiding questions to provoke thought."}
          </p>
        </div>

        {/* Custom Feedback Prompt */}
        <div className="mb-6">
          <label htmlFor="custom-prompt" className="block font-semibold text-gray-700 mb-2">
            Customize AI Feedback Prompt
          </label>
          
          {/* Prompt Presets */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              "Focus on grammar & spelling",
              "Be strict with grading",
              "Explain simply for student",
              "Highlight creative ideas"
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCustomPrompt(preset)}
                className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                + {preset}
              </button>
            ))}
          </div>

          <textarea
            id="custom-prompt"
            className="border border-gray-300 p-3 w-full h-20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Enter your custom feedback prompt here..."
          />
          <p className="text-xs text-gray-500 mt-1">This prompt will be sent to the AI when generating feedback. You can tailor it to your subject, rubric, or teaching style.</p>
        </div>
        {/* Essay Title */}
        <div className="mb-6">
          <label htmlFor="essay-title" className="block font-semibold text-gray-700 mb-2">
            Essay Title
          </label>
          <input
            id="essay-title"
            className="border border-gray-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            type="text"
            placeholder="Enter essay title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        
        {/* Rubric Selection */}
        <div className="mb-6">
          <label htmlFor="rubric-select" className="block font-semibold text-gray-700 mb-2">
            Select Rubric <span className="text-red-500">*</span>
          </label>
          <select
            id="rubric-select"
            value={rubricId}
            onChange={e => setRubricId(e.target.value)}
            className="border border-gray-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Choose a rubric --</option>
            {rubrics.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} {r.subject && `(${r.subject})`}
              </option>
            ))}
          </select>
          {rubrics.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              No rubrics found. <Link to="/rubrics" className="text-blue-600 hover:underline">Create one</Link> first.
            </p>
          )}
        </div>
        
        {/* Student Selection */}
        <div className="mb-6">
          <label htmlFor="student-select" className="block font-semibold text-gray-700 mb-2">
            Select Student <span className="text-gray-400 text-sm">(Optional)</span>
          </label>
          <select
            id="student-select"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className="border border-gray-300 p-3 w-full rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Unassigned --</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {students.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              No students found. <Link to="/students" className="text-blue-600 hover:underline">Add students</Link> to link essays.
            </p>
          )}
        </div>
        
        {/* Essay Content */}
        <div className="mb-6">
          <label htmlFor="essay-content" className="block font-semibold text-gray-700 mb-2">
            Essay Content
          </label>
          <textarea
            id="essay-content"
            className="border border-gray-300 p-3 w-full h-64 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Paste essay content here or upload a file..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="flex justify-between items-center mt-2">
            <p className={`text-sm ${content.trim().split(/\s+/).filter(Boolean).length > 3000 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
              Word count: {content.trim().split(/\s+/).filter(Boolean).length}
              {content.trim().split(/\s+/).filter(Boolean).length > 3000 && ' (Warning: Long essay may timeout)'}
            </p>
            {content && (
              <button
                type="button"
                onClick={() => setContent('')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Upload Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <label htmlFor="file-upload" className="sr-only">Upload essay file</label>
          <input
            id="file-upload"
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading && uploadProgress > 0 ? (
              <>
                <span className="animate-spin">⚡</span>
                <span>Processing ({uploadProgress}%)</span>
              </>
            ) : uploading ? (
              <>
                <span className="animate-spin">⚡</span>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>Upload File (.txt, .docx)</span>
              </>
            )}
          </button>
          
          <label htmlFor="scan-upload" className="sr-only">Scan essay image</label>
          <input
            id="scan-upload"
            ref={scanInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleScan}
          />
          <button
            type="button"
            onClick={() => scanInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading && uploadProgress > 0 ? (
              <>
                <span className="animate-spin">📸</span>
                <span>Scanning ({uploadProgress}%)</span>
              </>
            ) : uploading ? (
              <>
                <span className="animate-spin">📸</span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>📸</span>
                <span>Scan Document (OCR)</span>
              </>
            )}
          </button>
        </div>
        
        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !content.trim() || !title.trim() || !rubricId}
          className="w-full bg-green-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-6"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚡</span>
              <span>Generating AI Feedback...</span>
            </span>
          ) : (
            <span>✨ Generate AI Feedback</span>
          )}
        </button>

        {/* AO Legend Toggle */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowAoLegend(v => !v)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            <span>{showAoLegend ? '▼' : '▶'}</span>
            <span>Assessment Objectives (AO) Guide</span>
          </button>
          
          {showAoLegend && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">AO1: Content and Organisation</h4>
                <p className="text-sm text-blue-800">
                  • Identify and interpret explicit and implicit information and ideas<br />
                  • Select and synthesise evidence from different texts<br />
                  • Communicate clearly, effectively and imaginatively
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">AO2: Language, Structure and Form</h4>
                <p className="text-sm text-blue-800">
                  • Explain and analyse how writers use language and structure to achieve effects<br />
                  • Use relevant subject terminology to support your views
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">AO3: Context</h4>
                <p className="text-sm text-blue-800">
                  • Show understanding of relationships between texts and contexts<br />
                  • Consider how context influences meaning
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">AO4: SPaG (Spelling, Punctuation and Grammar)</h4>
                <p className="text-sm text-blue-800">
                  • Use a range of vocabulary and sentence structures<br />
                  • Use accurate spelling, punctuation and grammar
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Feedback Display */}
        {feedback && (
          <div ref={feedbackRef} className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 space-y-6 animate-fade-in-up">
            {/* Success Banner */}
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 rounded-full p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-900">✅ Feedback Generated & Saved!</h3>
                    <p className="text-green-700 text-sm mt-1">Your feedback is ready and has been saved to your history.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
                >
                  <span>✨</span>
                  <span>Grade Another Essay</span>
                </button>
                <Link
                  to="/feedback-history"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2"
                >
                  <span>📋</span>
                  <span>View All Feedback</span>
                </Link>
                <Link
                  to="/dashboard"
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold flex items-center gap-2"
                >
                  <span>🏠</span>
                  <span>Go to Dashboard</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">AI Feedback Results</h3>
              <div className="flex gap-3">
                {savedEssayId && (
                  <Link
                    to="/feedback-history"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    📋 View in History
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleExportDocx}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  📄 Export as DOCX
                </button>
                <button
                  type="button"
                  onClick={handleExportText}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  📄 Export as PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                >
                  🖨️ Print
                </button>
              </div>
            </div>

            {/* Score and Band Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-2">
                <div className="text-sm text-gray-600">Overall Score</div>
                <div className="text-3xl font-bold text-gray-900">{Math.round(feedback.overall_score)}%</div>
                <p className="text-sm text-gray-700">Out of 100 based on rubric and AI assessment.</p>
              </div>
              {bandAnalysis?.overall_band && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex flex-col gap-1">
                  <div className="text-sm text-indigo-700">GCSE Band</div>
                  <div className="text-2xl font-bold text-indigo-900">Band {bandAnalysis.overall_band}</div>
                  <div className="text-sm text-indigo-800">Approx. score: {bandAnalysis.overall_score ?? 'N/A'}%</div>
                  <p className="text-xs text-indigo-700">Based on AO analysis returned by the model.</p>
                </div>
              )}
              {feedback.criteria_scores && Object.keys(feedback.criteria_scores).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-700 mb-2">Criteria Scores</div>
                  <div className="space-y-2">
                    {Object.entries(feedback.criteria_scores).map(([criterion, score]) => (
                      <div key={criterion} className="flex items-center justify-between text-sm text-blue-900">
                        <span className="font-medium">{criterion}</span>
                        <span className="bg-white border border-blue-200 rounded px-2 py-1 text-xs">{Math.round(score)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Highlighted Essay View */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Essay with Highlights</h4>
              <div className="mb-3 flex gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-red-100 border-b-2 border-red-400"></span>
                  Grammar Issues
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-purple-100 border-b-2 border-purple-400"></span>
                  Rubric Match
                </span>
                <span className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 bg-green-100 border-b-2 border-green-400"></span>
                  Strengths
                </span>
              </div>
              <div className="bg-white p-4 rounded border border-gray-200 max-h-96 overflow-y-auto text-sm leading-relaxed">
                {highlightedEssay}
              </div>
            </div>
            
            {/* Overall Score with Band Analysis */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 transition-all hover:shadow-md">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold text-gray-700">Overall Score</span>
                    <span className="text-xs text-gray-500">Adjust slider to override AI score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={feedback.overall_score}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value)));
                        setFeedback({ ...feedback, overall_score: val });
                      }}
                      className="w-24 text-3xl font-bold text-blue-600 bg-white border border-blue-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none text-right"
                    />
                    <span className="text-3xl font-bold text-blue-600">/100</span>
                  </div>
                </div>
                
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={feedback.overall_score}
                    onChange={(e) => setFeedback({ ...feedback, overall_score: Number(e.target.value) })}
                    className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                    <span>0</span>
                    <span>25</span>
                    <span>50</span>
                    <span>75</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              
              {/* GCSE Band Analysis */}
              {bandAnalysis && (
                <div className="mt-4 pt-4 border-t border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="px-4 py-2 bg-blue-600 text-white rounded-full font-bold text-lg">
                      Band {bandAnalysis.overall_band}
                    </span>
                    <span className="text-sm text-gray-600">
                      {bandAnalysis.overall_band === 6 ? 'Exceptional' :
                       bandAnalysis.overall_band === 5 ? 'Secure' :
                       bandAnalysis.overall_band === 4 ? 'Developing' :
                       bandAnalysis.overall_band === 3 ? 'Emerging' :
                       bandAnalysis.overall_band === 2 ? 'Limited' : 'Basic'}
                    </span>
                  </div>
                  
                  {bandAnalysis.justification && (
                    <p className="text-sm text-gray-700 mb-4 italic">"{bandAnalysis.justification}"</p>
                  )}
                  
                  {/* Assessment Objectives Breakdown */}
                  {bandAnalysis.ao_bands && bandAnalysis.ao_bands.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-gray-800 text-sm mb-2">Assessment Objectives</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bandAnalysis.ao_bands.map((ao: any, idx: number) => (
                          <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-blue-700">{ao.ao}</span>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">
                                Band {ao.band}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600">{ao.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Grammar Issues */}
            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Grammar Issues</h4>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {feedback.grammar_issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
            
            {/* Strengths */}
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Strengths</h4>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {feedback.strengths.map((strength, idx) => (
                  <li key={idx}>{strength}</li>
                ))}
              </ul>
            </div>
            
            {/* Improvements */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold text-gray-800">Areas for Improvement</h4>
                <button
                  type="button"
                  onClick={() => setShowCommentBank((v) => !v)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 border rounded"
                >
                  {showCommentBank ? 'Hide' : 'Show'} Comment Bank
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-gray-700">
                {feedback.improvements.map((improvement, idx) => (
                  <li key={idx}>{improvement}</li>
                ))}
              </ul>
              {showCommentBank && (
                <div className="mt-4">
                  <CommentBank onInsert={handleInsertComment} />
                </div>
              )}
            </div>
            
            {/* Criteria Matches */}
            {feedback.criteria_matches && feedback.criteria_matches.length > 0 && (
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Rubric Criteria Analysis</h4>
                {feedback.criteria_matches.map((match, idx) => (
                  <div key={idx} className="mb-3">
                    <p className="font-medium text-gray-800">{match.criterion}</p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                      {match.examples.map((example, exIdx) => (
                        <li key={exIdx}>{example}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            
            {/* Suggested Feedback */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Suggested Feedback Summary</h4>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{feedback.suggested_feedback}</p>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        <KeyboardShortcutsHelp
          isOpen={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
          shortcuts={[
            { keys: 'Ctrl+Enter', description: 'Generate AI feedback' },
            { keys: 'Ctrl+Shift+P', description: 'Export PDF' },
            { keys: 'Ctrl+Shift+D', description: 'Export DOCX' },
            { keys: 'Ctrl+↑/↓', description: 'Adjust score ±1' },
            { keys: 'Shift+?', description: 'Toggle this help' },
          ]}
        />
        </>
        )}
      </div>
      </ErrorBoundary>
    </>
  );
}

export default EssayFeedback;