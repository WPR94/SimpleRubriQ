import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import notify from '../utils/notify';
import { parseEssayFile } from '../utils/essayParser';
import { generateAiFeedback } from '../utils/edgeFunctions';
import JSZip from 'jszip';
import Navbar from '../components/Navbar';
import { PageGuide } from '../components/PageGuide';

interface BatchEssay {
  id: string;
  filename: string;
  title: string;
  content: string;
  studentId?: string;
  studentName?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  wordCount: number;
  score?: number;
  error?: string;
  feedbackId?: string;
}

interface Student {
  id: string;
  name: string;
}

function BatchProcessor() {
  const { user } = useAuth();
  const [essays, setEssays] = useState<BatchEssay[]>([]);
  const [rubricId, setRubricId] = useState<string>('');
  const [rubrics, setRubrics] = useState<Array<{ id: string; name: string; subject: string }>>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [autoMatchStudents, setAutoMatchStudents] = useState(true);
  const [aiPreMark, setAiPreMark] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      // Load rubrics
      const { data: rubricsData } = await supabase
        .from('rubrics')
        .select('id, name, subject')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      
      if (rubricsData) setRubrics(rubricsData);
      
      // Load students
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name')
        .eq('teacher_id', user.id)
        .eq('active', true)
        .order('name');
      
      if (studentsData) setStudents(studentsData);
    };
    
    loadData();
  }, [user]);

  const handleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const loadedEssays: BatchEssay[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        if (file.name.endsWith('.zip')) {
          // Handle ZIP file
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);
          
          for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
            if (zipEntry.dir) continue;
            if (!filename.match(/\.(txt|docx|pdf)$/i)) continue;
            
            const blob = await zipEntry.async('blob');
            const essayFile = new File([blob], filename);
            
            try {
              const content = await parseEssayFile(essayFile);
              const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
              
              loadedEssays.push({
                id: Math.random().toString(36).substr(2, 9),
                filename,
                title: filename.replace(/\.(txt|docx|pdf)$/i, ''),
                content,
                wordCount,
                status: 'pending',
              });
            } catch (error) {
              console.error(`Failed to parse ${filename}:`, error);
              errors.push(`${filename}: ${error instanceof Error ? error.message : 'Parse failed'}`);
            }
          }
        } else if (file.name.match(/\.(txt|docx|pdf)$/i)) {
          // Handle individual essay files
          try {
            const content = await parseEssayFile(file);
            const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
            
            loadedEssays.push({
              id: Math.random().toString(36).substr(2, 9),
              filename: file.name,
              title: file.name.replace(/\.(txt|docx|pdf)$/i, ''),
              content,
              wordCount,
              status: 'pending',
            });
          } catch (error) {
            console.error(`Failed to parse ${file.name}:`, error);
            errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Parse failed'}`);
          }
        }
      }

      if (loadedEssays.length === 0) {
        if (errors.length > 0) {
          notify.error(`Failed to load essays. Errors: ${errors.join('; ')}`);
        } else {
          notify.error('No valid essay files found');
        }
        return;
      }
      
      if (errors.length > 0) {
        notify.info(`Loaded ${loadedEssays.length} essays. ${errors.length} files failed to load.`);
      }

      // Auto-match students by filename if enabled
      if (autoMatchStudents && students.length > 0) {
        loadedEssays.forEach(essay => {
          const matchedStudent = students.find(s => 
            essay.filename.toLowerCase().includes(s.name.toLowerCase()) ||
            essay.title.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedStudent) {
            essay.studentId = matchedStudent.id;
            essay.studentName = matchedStudent.name;
          }
        });
      }

      setEssays(loadedEssays);
      notify.success(`Loaded ${loadedEssays.length} essays`);
    } catch (error: any) {
      console.error('File upload error:', error);
      notify.error('Failed to load files: ' + error.message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const updateEssayStudent = (essayId: string, studentId: string) => {
    setEssays(prev => prev.map(e => {
      if (e.id === essayId) {
        const student = students.find(s => s.id === studentId);
        return {
          ...e,
          studentId: studentId || undefined,
          studentName: student?.name || undefined,
        };
      }
      return e;
    }));
  };

  const startProcessing = async () => {
    if (!rubricId) {
      notify.error('Please select a rubric');
      return;
    }

    if (!user) {
      notify.error('Please sign in');
      return;
    }

    setProcessing(true);
    setCurrentIndex(0);
    setProgress(0);
    isPaused.current = false;

    // Get rubric criteria
    const { data: rubricData, error: rubricError } = await supabase
      .from('rubrics')
      .select('criteria')
      .eq('id', rubricId)
      .single();

    if (rubricError || !rubricData) {
      notify.error('Failed to load rubric');
      setProcessing(false);
      return;
    }

    const pendingEssays = essays.filter(e => e.status === 'pending' || e.status === 'error');
    
    for (let i = 0; i < pendingEssays.length; i++) {
      if (isPaused.current) break;

      const essay = pendingEssays[i];
      setCurrentIndex(i);

      // Update status to processing
      setEssays(prev => prev.map(e => 
        e.id === essay.id ? { ...e, status: 'processing' } : e
      ));

      try {
        // Generate AI feedback if enabled
        let aiFeedback = null;
        if (aiPreMark) {
          aiFeedback = await generateAiFeedback(essay.content, { criteria: rubricData.criteria });
        }

        // Save essay to database
        const { data: essayDbData, error: essayError } = await supabase
          .from('essays')
          .insert([{
            title: essay.title,
            content: essay.content,
            word_count: essay.wordCount,
            teacher_id: user.id,
            rubric_id: rubricId,
            student_id: essay.studentId || null,
          }])
          .select('id')
          .single();

        if (essayError || !essayDbData) {
          throw new Error('Failed to save essay');
        }

        // Save feedback to database if AI pre-mark is enabled
        let feedbackDbData = null;
        if (aiPreMark && aiFeedback) {
          const { data: feedbackData, error: feedbackError } = await supabase
            .from('feedback')
            .insert([{
              essay_id: essayDbData.id,
              rubric_id: rubricId,
              grammar_issues: aiFeedback.grammar_issues,
              strengths: aiFeedback.strengths,
              improvements: aiFeedback.improvements,
              suggested_feedback: aiFeedback.suggested_feedback,
              overall_score: aiFeedback.overall_score,
            }])
            .select('id')
            .single();

          if (feedbackError || !feedbackData) {
            throw new Error('Failed to save feedback');
          }
          feedbackDbData = feedbackData;
        }

        // Update essay status to completed
        setEssays(prev => prev.map(e => 
          e.id === essay.id 
            ? { 
                ...e, 
                status: 'completed', 
                score: aiFeedback?.overall_score,
                feedbackId: feedbackDbData?.id,
              } 
            : e
        ));

      } catch (error: any) {
        console.error(`Error processing essay ${essay.title}:`, error);
        setEssays(prev => prev.map(e => 
          e.id === essay.id 
            ? { ...e, status: 'error', error: error.message } 
            : e
        ));
      }

      // Update progress
      setProgress(Math.round(((i + 1) / pendingEssays.length) * 100));
    }

    setProcessing(false);
    setShowResults(true);
    notify.success('Batch processing completed!');
  };

  const pauseProcessing = () => {
    isPaused.current = true;
    setProcessing(false);
    notify.info('Processing paused');
  };

  const exportResults = () => {
    const csv = [
      ['Title', 'Student', 'Score', 'Word Count', 'Status', 'Error'].join(','),
      ...essays.map(e => [
        `"${e.title}"`,
        `"${e.studentName || 'Unassigned'}"`,
        e.score || '',
        e.wordCount,
        e.status,
        `"${e.error || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetBatch = () => {
    setEssays([]);
    setProgress(0);
    setCurrentIndex(0);
    setShowResults(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'processing': return 'text-blue-600 bg-blue-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'processing': return '⟳';
      case 'error': return '✗';
      default: return '○';
    }
  };

  const completedCount = essays.filter(e => e.status === 'completed').length;
  const errorCount = essays.filter(e => e.status === 'error').length;
  const pendingCount = essays.filter(e => e.status === 'pending').length;

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Batch Essay Processor</h2>
            <p className="text-gray-600 mt-1">Grade multiple essays at once with AI-powered feedback</p>
          </div>
          <PageGuide
            title="How to use Batch Processing"
            ctaLabel="Page guide"
            summary="Upload a set of essays, apply one rubric, and export results."
            sections={[
              {
                title: 'Upload essays',
                body: <p>Add .txt/.docx/.pdf files or a ZIP. Use student names in filenames for auto-matching.</p>,
              },
              {
                title: 'Select rubric & options',
                body: <p>Choose one rubric for all essays. Toggle AI pre-mark and student auto-match as needed.</p>,
              },
              {
                title: 'Run and monitor',
                body: <p>Start Processing to grade pending essays. Pause/resume as needed; progress and statuses update live.</p>,
              },
              {
                title: 'Review & export',
                body: <p>When finished, view scores/feedback and export results for sharing.</p>,
              },
            ]}
          />
        </div>

        {/* Upload Section */}
        {essays.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Essays</h3>
              <p className="text-gray-600 mb-6">
                Upload multiple .txt, .docx, or .pdf files, or a ZIP file containing essays
              </p>
              
              <label className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 cursor-pointer font-medium">
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Select Files or ZIP
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.docx,.pdf,.zip"
                  onChange={handleFilesUpload}
                  className="hidden"
                />
              </label>
              
              <div className="mt-6 flex items-center justify-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoMatchStudents}
                    onChange={e => setAutoMatchStudents(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Auto-match students by filename
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-3">Tips:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Upload multiple .txt, .docx, or .pdf files at once</li>
                <li>• Or upload a ZIP file containing all essays</li>
                <li>• Name files with student names for auto-matching (e.g., "John_Doe_Essay.docx")</li>
                <li>• All essays will be graded using the same rubric</li>
              </ul>
            </div>
          </div>
        )}

        {/* Configuration Section */}
        {essays.length > 0 && !showResults && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block font-medium text-gray-700 mb-2">
                  Select Rubric <span className="text-red-500">*</span>
                </label>
                <select
                  aria-label="Select rubric for batch processing"
                  value={rubricId}
                  onChange={e => setRubricId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={processing}
                >
                  <option value="">-- Choose a rubric --</option>
                  {rubrics.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.subject && `(${r.subject})`}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block font-medium text-gray-700 mb-2">Options</label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={aiPreMark}
                      onChange={e => setAiPreMark(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      disabled={processing}
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      AI pre-mark on upload <span className="text-gray-500">(generate feedback automatically)</span>
                    </span>
                  </label>
                  <div className="text-xs text-gray-500 ml-6">
                    When enabled, AI feedback is generated and saved for each essay. Disable to upload without marking.
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="block font-medium text-gray-700 mb-2">Status</label>
              <div className="flex gap-4">
                <div className="bg-gray-50 rounded-lg px-4 py-3 flex-1">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{essays.length}</p>
                </div>
                <div className="bg-green-50 rounded-lg px-4 py-3 flex-1">
                  <p className="text-sm text-green-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                </div>
                <div className="bg-red-50 rounded-lg px-4 py-3 flex-1">
                  <p className="text-sm text-red-600">Errors</p>
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {!processing && pendingCount > 0 && (
                <button
                  onClick={startProcessing}
                  disabled={!rubricId}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Start Processing ({pendingCount} essays)
                </button>
              )}
              {processing && (
                <button
                  onClick={pauseProcessing}
                  className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 font-medium"
                >
                  Pause
                </button>
              )}
              <button
                onClick={resetBatch}
                disabled={processing}
                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 font-medium"
              >
                Reset
              </button>
            </div>

            {processing && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Processing... ({currentIndex + 1} of {pendingCount})</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Essays List */}
        {essays.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Essays ({essays.length})</h3>
              {showResults && (
                <button
                  onClick={exportResults}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Results
                </button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Essay Title</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Words</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Score</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {essays.map((essay) => (
                    <tr key={essay.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(essay.status)}`}>
                          {getStatusIcon(essay.status)} {essay.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{essay.title}</td>
                      <td className="px-4 py-3">
                        {!processing && essay.status === 'pending' ? (
                          <select
                            aria-label={`Assign student to ${essay.title}`}
                            value={essay.studentId || ''}
                            onChange={e => updateEssayStudent(essay.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Unassigned</option>
                            {students.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm text-gray-600">{essay.studentName || 'Unassigned'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{essay.wordCount}</td>
                      <td className="px-4 py-3">
                        {essay.score !== undefined && (
                          <span className="text-sm font-semibold text-green-600">{essay.score}/100</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">{essay.error || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default BatchProcessor;