import { useEffect, useMemo, useState, useRef } from 'react';
import { getTemplatesByBoard, getTemplate, GCSERubricTemplate } from '../data/gcseTemplates';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import notify from '../utils/notify';
import { parseRubricFile, parseRubricText, criteriaToCriteriaState } from '../utils/rubricParser';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import { FormSkeleton } from '../components/LoadingSkeleton';
import ConfirmModal from '../components/ConfirmModal';

interface Criterion {
  id: number;
  category: string;
  maxPoints: number;
}

interface RubricRow {
  id: string; // uuid
  subject: string | null;
  name: string;
  description?: string | null;
  criteria: any; // jsonb
  isDefault?: boolean;
  created_at?: string;
  exam_board?: string | null;
  template_id?: string | null;
  version?: number;
  cloned_from?: string | null;
}

function Rubrics() {
  const { user } = useAuth();
  const [rubrics, setRubrics] = useState<RubricRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subject, setSubject] = useState('English');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<Criterion[]>([{ id: 0, category: '', maxPoints: 10 }]);
  const [isDefault, setIsDefault] = useState(false);
  // Phase 1 additions
  const [examBoard, setExamBoard] = useState<string>('AQA');
  const [templateId, setTemplateId] = useState<string>('');
  const [availableTemplates, setAvailableTemplates] = useState<GCSERubricTemplate[]>(getTemplatesByBoard('AQA'));
  const [uploading, setUploading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [rubricToDelete, setRubricToDelete] = useState<string | null>(null);
  const [essayCount, setEssayCount] = useState<number>(0);
  const [feedbackCount, setFeedbackCount] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const criteriaJson = useMemo(() => (
    criteria.map(c => ({ category: c.category, maxPoints: c.maxPoints }))
  ), [criteria]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        // Timeout protection for maintenance/downtime (increased to 30s for cold starts)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timed out - Supabase may be under maintenance')), 30000)
        );
        const fetchPromise = supabase
          .from('rubrics')
          .select('id, name, subject, criteria, created_at, exam_board, template_id, version, cloned_from')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false });
        
        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
        
        if (!mounted) return;

        if (error) {
          console.error(error);
          notify.error('Failed to load rubrics');
          setRubrics([]);
        } else {
          setRubrics(data as RubricRow[]);
        }
      } catch (error: any) {
        if (!mounted) return;
        
        const isTimeout = error.message === 'Request timed out - Supabase may be under maintenance';
        
        if (isTimeout) {
          console.warn('Rubrics load timed out (likely cold start)');
        } else {
          console.error('Rubrics load error:', error);
          notify.error(`Failed to load rubrics: ${error.message || 'Unknown error'}`);
        }
        setRubrics([]); // Clear to empty state instead of hanging
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const handleCriterionChange = (idx: number, field: keyof Criterion, value: string | number) => {
    setCriteria(prev => prev.map(c => (c.id === idx ? { ...c, [field]: field === 'maxPoints' ? Number(value) : value } : c)));
  };

  const addCriterion = () => {
    const newId = criteria.length > 0 ? Math.max(...criteria.map(c => c.id)) + 1 : 0;
    setCriteria(prev => [...prev, { id: newId, category: '', maxPoints: 10 }]);
  };

  const removeCriterion = (id: number) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
  };

  const resetForm = () => {
    setSubject('English');
    setName('');
    setDescription('');
    setCriteria([{ id: 0, category: '', maxPoints: 10 }]);
    setIsDefault(false);
    setExamBoard('AQA');
    setTemplateId('');
    setAvailableTemplates(getTemplatesByBoard('AQA'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      notify.error('Please sign in to save rubrics');
      return;
    }
    
    // Validation
    if (!name.trim()) {
      notify.error('Please enter a rubric name');
      return;
    }
    
    if (criteria.length === 0 || criteria.every(c => !c.category.trim())) {
      notify.error('Please add at least one criterion');
      return;
    }
    
    const { data, error } = await supabase
      .from('rubrics')
      .insert([
        {
          name,
          subject,
          criteria: criteriaJson,
          teacher_id: user.id,
          exam_board: examBoard,
          template_id: templateId || null,
          version: 1,
        },
      ])
      .select('id, name, subject, criteria, created_at, exam_board, template_id, version, cloned_from')
      .single();
    if (error) {
      console.error('Rubric save error:', error);
      notify.error(`Failed to save rubric: ${error.message}`);
      return;
    }
    setRubrics(prev => [data as RubricRow, ...prev]);
    notify.success('Rubric saved');
    resetForm();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Parse the file
      const text = await parseRubricFile(file);
      
      // Parse text into structured criteria
      const parsed = parseRubricText(text);
      
      if (parsed.length === 0) {
        notify.error('No criteria found in file. Please check the format.');
        return;
      }

      // Convert to form state
      const newCriteria = criteriaToCriteriaState(parsed);
      setCriteria(newCriteria);
      
      // Auto-fill name from filename if not set
      if (!name) {
        const baseName = file.name.replace(/\.(txt|docx|pdf)$/i, '');
        setName(baseName);
      }

      notify.success(`Loaded ${parsed.length} criteria from ${file.name}`);
    } catch (error) {
      console.error('File upload error:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to parse rubric file');
    } finally {
      setUploading(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openDeleteModal = async (id: string) => {
    setRubricToDelete(id);
    
    // Count essays and feedback using this rubric
    try {
      const [essaysResult, feedbackResult] = await Promise.all([
        supabase.from('essays').select('id', { count: 'exact', head: true }).eq('rubric_id', id),
        supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('rubric_id', id)
      ]);
      
      setEssayCount(essaysResult.count || 0);
      setFeedbackCount(feedbackResult.count || 0);
    } catch (error) {
      console.error('Error counting dependencies:', error);
      setEssayCount(0);
      setFeedbackCount(0);
    }
    
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!rubricToDelete) return;

    try {
      // If there are essays or feedback, unlink them (set rubric_id to NULL)
      if (essayCount > 0) {
        const { error: essayError } = await supabase
          .from('essays')
          .update({ rubric_id: null })
          .eq('rubric_id', rubricToDelete);

        if (essayError) throw essayError;
      }

      if (feedbackCount > 0) {
        const { error: feedbackError } = await supabase
          .from('feedback')
          .update({ rubric_id: null })
          .eq('rubric_id', rubricToDelete);

        if (feedbackError) throw feedbackError;
      }

      // Now safe to delete the rubric
      const { error } = await supabase
        .from('rubrics')
        .delete()
        .eq('id', rubricToDelete);

      if (error) throw error;

      setRubrics(prev => prev.filter(r => r.id !== rubricToDelete));
      
      if (essayCount > 0 || feedbackCount > 0) {
        notify.success(`Rubric deleted. ${essayCount} essays and ${feedbackCount} feedback entries were unlinked.`);
      } else {
        notify.success('Rubric deleted successfully');
      }
      
      setDeleteModalOpen(false);
      setRubricToDelete(null);
      setEssayCount(0);
      setFeedbackCount(0);
    } catch (error: any) {
      console.error('Error deleting rubric:', error);
      notify.error(`Failed to delete rubric: ${error.message || 'Unknown error'}`);
      setDeleteModalOpen(false);
      setRubricToDelete(null);
      setEssayCount(0);
      setFeedbackCount(0);
    }
  };

  const handleClone = async (rubricId: string) => {
    if (!user) {
      notify.error('Please sign in to clone rubrics');
      return;
    }

    const original = rubrics.find(r => r.id === rubricId);
    if (!original) return;

    try {
      // Get current version or default to 1
      const { data: versionData } = await supabase
        .from('rubrics')
        .select('version')
        .eq('id', rubricId)
        .single();
      
      const currentVersion = versionData?.version || 1;

      // Create cloned rubric with incremented version
      const { data, error } = await supabase
        .from('rubrics')
        .insert([{
          name: `${original.name} (v${currentVersion + 1})`,
          subject: original.subject,
          criteria: original.criteria,
          teacher_id: user.id,
          exam_board: (original as any).exam_board || null,
          template_id: (original as any).template_id || null,
          version: currentVersion + 1,
          cloned_from: rubricId,
        }])
        .select('id, name, subject, criteria, created_at, exam_board, template_id, version, cloned_from')
        .single();

      if (error) throw error;

      setRubrics(prev => [data as RubricRow, ...prev]);
      notify.success(`Rubric cloned as version ${currentVersion + 1}`);
    } catch (error: any) {
      console.error('Clone error:', error);
      notify.error(`Failed to clone rubric: ${error.message}`);
    }
  };

  // Filtering & grouping state
  const [examBoardFilter, setExamBoardFilter] = useState<string>('All');
  const [groupView, setGroupView] = useState<boolean>(true);
  const [lineageModalOpen, setLineageModalOpen] = useState(false);
  const [lineageRubrics, setLineageRubrics] = useState<RubricRow[]>([]);
  const [lineageBaseName, setLineageBaseName] = useState<string>('');

  const filteredRubrics = useMemo(() => {
    return rubrics.filter(r => examBoardFilter === 'All' || (r.exam_board || 'Unknown') === examBoardFilter);
  }, [rubrics, examBoardFilter]);

  const groupedRubrics = useMemo(() => {
    if (!groupView) return [] as { base: string; items: RubricRow[] }[];
    const groups: Record<string, RubricRow[]> = {};
    filteredRubrics.forEach(r => {
      // Extract base name by stripping a trailing (vN)
      const base = r.name.replace(/\(v\d+\)$/,'').trim();
      if (!groups[base]) groups[base] = [];
      groups[base].push(r);
    });
    return Object.entries(groups).map(([base, items]) => ({
      base,
      items: items.sort((a,b) => (b.version || 1) - (a.version || 1))
    })).sort((a,b) => a.base.localeCompare(b.base));
  }, [filteredRubrics, groupView]);

  const openLineageModal = (rubric: RubricRow) => {
    // Determine base name and collect all rubrics sharing base name
    const base = rubric.name.replace(/\(v\d+\)$/,'').trim();
    const related = rubrics.filter(r => r.name.replace(/\(v\d+\)$/,'').trim() === base)
      .sort((a,b) => (a.version || 1) - (b.version || 1));
    setLineageBaseName(base);
    setLineageRubrics(related);
    setLineageModalOpen(true);
  };

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Rubrics Manager</h2>
        {loading ? (
          <div className="space-y-4">
            <FormSkeleton />
            <FormSkeleton />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="border p-4 sm:p-6 bg-gray-50 rounded mb-6 space-y-4">
          {/* Exam Board & Template Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold mb-1">Exam Board</label>
              <select aria-label="Exam Board"
                value={examBoard}
                onChange={e => {
                  const board = e.target.value;
                  setExamBoard(board);
                  const list = getTemplatesByBoard(board === 'WJEC Eduqas' ? 'WJEC' : board);
                  setAvailableTemplates(list);
                  setTemplateId('');
                }}
                className="border p-2 w-full"
              >
                {['AQA','Edexcel','OCR','WJEC','WJEC Eduqas'].map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">GCSE Template</label>
              <select aria-label="GCSE Template"
                value={templateId}
                onChange={e => {
                  const id = e.target.value;
                  setTemplateId(id);
                  if (id) {
                    const tpl = getTemplate(id);
                    if (tpl) {
                      // Apply template to form
                      if (!name) setName(`${tpl.subject} (${tpl.examBoard})`);
                      // Map bands to criteria
                      const mapped: Criterion[] = tpl.bands.map((b, idx) => ({ id: idx, category: `Band ${b.band} – ${b.level}`, maxPoints: b.band }));
                      setCriteria(mapped.length ? mapped : [{ id: 0, category: '', maxPoints: 10 }]);
                      // Prepend AO info to description if empty
                      if (!description) {
                        setDescription(tpl.assessmentObjectives.map(a => `${a.ao}: ${a.description}`).join(' | '));
                      }
                    }
                  }
                }}
                className="border p-2 w-full"
              >
                <option value="">(Optional) Select template…</option>
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.subject} – {t.examBoard}</option>
                ))}
              </select>
            </div>
          </div>
          {/* File Upload Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-blue-900">Upload Rubric File</h3>
                <p className="text-sm text-blue-700">Import criteria from .txt, .docx, or .pdf files</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <label htmlFor="rubric-file-upload" className="sr-only">Upload rubric file</label>
              <input
                type="file"
                id="rubric-file-upload"
                ref={fileInputRef}
                accept=".txt,.docx,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin">⚡</span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <span>📄</span>
                    <span>Choose File</span>
                  </>
                )}
              </button>
              <p className="text-xs text-gray-600">
                Supported formats: .txt, .docx (PDF coming soon)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold mb-1">Subject</label>
              <select aria-label="Subject" value={subject} onChange={e => setSubject(e.target.value)} className="border p-2 w-full">
                <option>English</option>
                <option>Math</option>
                <option>Science</option>
                <option>History</option>
                <option>Geography</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Rubric Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="border p-2 w-full" placeholder="Name" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold mb-1">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="border p-2 w-full"
                placeholder="Short description"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-2">Criteria</label>
            {templateId && (
              <div className="text-xs mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded">
                Loaded template <strong>{templateId}</strong>. You can still edit criteria below.
              </div>
            )}
            {criteria.map((c) => (
              <div key={c.id} className="flex flex-col sm:flex-row gap-2 mb-2 sm:items-center">
                <input
                  className="border p-2 flex-1 w-full"
                  placeholder="Criterion category (e.g. Grammar)"
                  value={c.category}
                  onChange={e => handleCriterionChange(c.id, 'category', e.target.value)}
                  required
                />
                <div className="flex gap-2 items-center">
                  <label className="sr-only" htmlFor={`maxPoints-${c.id}`}>Max points</label>
                  <input
                    id={`maxPoints-${c.id}`}
                    className="border p-2 w-24"
                    type="number"
                    min="1"
                    value={c.maxPoints}
                    onChange={e => handleCriterionChange(c.id, 'maxPoints', e.target.value)}
                    required
                  />
                  {criteria.length > 1 && (
                    <button type="button" aria-label="Remove criterion" onClick={() => removeCriterion(c.id)} className="text-red-600 px-2">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addCriterion} className="text-blue-600">Add Criterion</button>
          </div>
          <div className="flex items-center space-x-2">
            <input type="checkbox" id="default" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
            <label htmlFor="default">Set as default rubric for this subject</label>
          </div>
          <button type="submit" className="bg-green-600 text-white py-2 px-4 rounded">Save Rubric</button>
        </form>
        )}
        <h3 className="text-xl font-bold mb-4">Your Rubrics</h3>
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4 items-center">
          <div>
            <label className="text-sm font-semibold mr-2">Exam Board:</label>
            <select aria-label="Exam Board Filter"
              value={examBoardFilter}
              onChange={e => setExamBoardFilter(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="All">All</option>
              {Array.from(new Set(rubrics.map(r => r.exam_board).filter(Boolean))).map(b => (
                <option key={b as string}>{b as string}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setGroupView(v => !v)}
            className="text-sm px-3 py-2 rounded border bg-white hover:bg-gray-50"
          >
            {groupView ? 'Switch to Flat View' : 'Group by Version Lineage'}
          </button>
          <span className="text-xs text-gray-600">Showing {filteredRubrics.length} rubric(s)</span>
        </div>
        {/* Empty state */}
        {!loading && rubrics.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-5xl mb-3">📋</div>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">No rubrics yet</h4>
            <p className="text-gray-600 mb-4">Create your first rubric using the form above or import from a template.</p>
            <div className="space-x-3">
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-blue-600 hover:underline">Jump to form</a>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Retry loading
              </button>
            </div>
          </div>
        ) : groupView ? (
          <div className="space-y-6">
            {groupedRubrics.map(group => (
              <div key={group.base} className="border rounded bg-gray-50">
                <div className="px-4 py-2 border-b flex items-center justify-between">
                  <h4 className="font-semibold">{group.base}</h4>
                  <span className="text-xs text-gray-500">{group.items.length} version(s)</span>
                </div>
                <div className="divide-y">
                  {group.items.map(r => (
                    <div key={r.id} className="p-4 bg-white flex justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          {r.version && r.version > 1 && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">v{r.version}</span>
                          )}
                          {r.exam_board && (
                            <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{r.exam_board}</span>
                          )}
                        </div>
                        {Array.isArray(r.criteria) && (
                          <ul className="list-disc pl-5 mt-2 text-sm">
                            {r.criteria.slice(0,3).map((c: any, idx: number) => (
                              <li key={idx}>{c.category} — {c.maxPoints} pts</li>
                            ))}
                            {r.criteria.length > 3 && (
                              <li className="italic text-gray-500">…{r.criteria.length - 3} more</li>
                            )}
                          </ul>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 ml-4 text-right">
                        <button
                          onClick={() => handleClone(r.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >Clone</button>
                        <button
                          onClick={() => openLineageModal(r)}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >Lineage</button>
                        <button
                          onClick={() => openDeleteModal(r.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groupedRubrics.length === 0 && <p className="text-gray-500">No rubrics match this filter.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRubrics.map(r => (
              <div key={r.id} className="border p-4 rounded bg-white shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{r.name} {r.subject ? `(${r.subject})` : ''}</h4>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {r.exam_board && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{r.exam_board}</span>}
                      {r.version && r.version > 1 && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">v{r.version}</span>}
                    </div>
                    {Array.isArray(r.criteria) && (
                      <ul className="list-disc pl-5 mt-2">
                        {r.criteria.map((c: any, idx: number) => (
                          <li key={idx}>{c.category} — {c.maxPoints} pts</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleClone(r.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                      title="Clone this rubric"
                    >
                      Clone
                    </button>
                    <button
                      onClick={() => openLineageModal(r)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                      title="View version lineage"
                    >
                      Lineage
                    </button>
                    <button
                      onClick={() => openDeleteModal(r.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filteredRubrics.length === 0 && <p className="text-gray-500">No rubrics match this filter.</p>}
          </div>
        )}
      </div>
      </ErrorBoundary>
      {lineageModalOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="lineage-title" className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h4 id="lineage-title" className="font-semibold text-lg">Version Lineage – {lineageBaseName}</h4>
              <button onClick={() => setLineageModalOpen(false)} aria-label="Close lineage modal" className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {lineageRubrics.length === 0 && <p className="text-gray-500">No versions found.</p>}
              {lineageRubrics.length > 0 && (
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-2 border">Version</th>
                      <th className="p-2 border">Name</th>
                      <th className="p-2 border">Exam Board</th>
                      <th className="p-2 border">Criteria</th>
                      <th className="p-2 border">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineageRubrics.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="p-2 border">{r.version || 1}</td>
                        <td className="p-2 border">{r.name}</td>
                        <td className="p-2 border">{r.exam_board || '—'}</td>
                        <td className="p-2 border">{Array.isArray(r.criteria) ? r.criteria.length : '—'}</td>
                        <td className="p-2 border">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setLineageModalOpen(false)}
                  className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
                >Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setRubricToDelete(null);
          setEssayCount(0);
          setFeedbackCount(0);
        }}
        onConfirm={handleDelete}
        title="Delete Rubric"
        message={
          essayCount > 0 || feedbackCount > 0
            ? `This rubric is used by ${essayCount} essay(s) and ${feedbackCount} feedback record(s). Deleting it will unlink these items (they won't be deleted, just have no rubric assigned). Continue?`
            : "Are you sure you want to delete this rubric? This action cannot be undone."
        }
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

export default Rubrics;