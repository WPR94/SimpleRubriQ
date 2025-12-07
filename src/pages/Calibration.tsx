import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import notify from '../utils/notify';
import ErrorBoundary from '../components/ErrorBoundary';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { PageGuide } from '../components/PageGuide';

interface RubricLite { id: string; name: string; }
interface EssayLite { id: string; title: string; content: string; rubric_id: string | null; }
interface CalibrationSession { id: string; name: string; rubric_id: string | null; status: string; created_at: string; }
interface CalibrationMark { id: string; essay_id: string; marker_id: string; scores: { ao1: number; ao2: number; ao3: number; ao4: number }; }

function Calibration() {
  const { user } = useAuth();
  const [rubrics, setRubrics] = useState<RubricLite[]>([]);
  const [essays, setEssays] = useState<EssayLite[]>([]);
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [selectedEssayIds, setSelectedEssayIds] = useState<string[]>([]);
  const [sessionName, setSessionName] = useState('Calibration Set');
  const [sessionRubricId, setSessionRubricId] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [marks, setMarks] = useState<CalibrationMark[]>([]);
  const [currentEssayId, setCurrentEssayId] = useState<string>('');
  const [scores, setScores] = useState({ ao1: 0, ao2: 0, ao3: 0, ao4: 0 });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);

  const loadInitial = async () => {
    if (!user) return;
    setInitialLoading(true);
    setFetchError(null);
    try {
      const [rubricRes, essayRes, sessionRes] = await Promise.all([
        supabase.from('rubrics').select('id, name').eq('teacher_id', user.id),
        supabase.from('essays').select('id, title, content, rubric_id').eq('teacher_id', user.id).limit(50),
        supabase.from('calibration_sessions').select('id, name, rubric_id, status, created_at').eq('created_by', user.id).order('created_at', { ascending: false })
      ]);

      if (rubricRes.error || essayRes.error || sessionRes.error) {
        const msg = rubricRes.error?.message || essayRes.error?.message || sessionRes.error?.message || 'Failed to load data';
        setFetchError(msg);
      }

      setRubrics((rubricRes.data || []) as RubricLite[]);
      setEssays((essayRes.data || []) as EssayLite[]);
      setSessions((sessionRes.data || []) as CalibrationSession[]);
    } catch (e: any) {
      setFetchError(e?.message || 'Unexpected error loading data');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadInitial();
  }, [user]);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' && localStorage.getItem('calibrationExplainerDismissed') === '1';
    if (dismissed) setShowExplainer(false);
  }, []);

  // (Future) sessionEssays reserved for expanded UI; suppress unused warning for now

  const createSession = async () => {
    if (!user) return notify.error('Sign in required');
    if (!sessionName.trim()) return notify.error('Session name required');
    if (!sessionRubricId) return notify.error('Select a rubric');
    if (selectedEssayIds.length < 1) return notify.error('Select at least one essay');
    setLoading(true);
    try {
      const { data: session, error } = await supabase
        .from('calibration_sessions')
        .insert([{ name: sessionName.trim(), rubric_id: sessionRubricId, created_by: user.id }])
        .select('*')
        .single();
      if (error) throw error;

      // Link essays
      const linkRows = selectedEssayIds.map(id => ({ session_id: session.id, essay_id: id }));
      const { error: linkError } = await supabase.from('calibration_session_essays').insert(linkRows);
      if (linkError) throw linkError;

      setSessions(prev => [session as CalibrationSession, ...prev]);
      setActiveSessionId(session.id);
      notify.success('Calibration session created');
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const loadMarks = async (essayId: string) => {
    if (!activeSessionId) return;
    const { data } = await supabase
      .from('calibration_marks')
      .select('id, essay_id, marker_id, scores')
      .eq('session_id', activeSessionId)
      .eq('essay_id', essayId);
    setMarks((data || []) as CalibrationMark[]);
  };

  const openEssayForMarking = (essayId: string) => {
    setCurrentEssayId(essayId);
    setScores({ ao1: 0, ao2: 0, ao3: 0, ao4: 0 });
    loadMarks(essayId);
  };

  const submitMark = async () => {
    if (!user) return notify.error('Sign in required');
    if (!activeSessionId || !currentEssayId) return notify.error('Select a session and essay');
    const { error } = await supabase
      .from('calibration_marks')
      .insert([{ session_id: activeSessionId, essay_id: currentEssayId, marker_id: user.id, scores }]);
    if (error) return notify.error(error.message);
    notify.success('Mark submitted');
    loadMarks(currentEssayId);
  };

  const stats = useMemo(() => {
    if (marks.length === 0) return null;
    const fields: (keyof CalibrationMark['scores'])[] = ['ao1','ao2','ao3','ao4'];
    const result: Record<string, { avg: number; sd: number; values: number[] }> = {};
    fields.forEach(f => {
      const vals = marks.map(m => m.scores[f]);
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      const variance = vals.reduce((a,b)=>a+Math.pow(b-avg,2),0)/vals.length;
      result[f] = { avg, sd: Math.sqrt(variance), values: vals };
    });
    return result;
  }, [marks]);

  return (
    <ErrorBoundary>
      <Navbar />
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold">Calibration / Moderation</h2>
          <PageGuide
            title="How to run Calibration"
            ctaLabel="Page guide"
            summary="Align marking across your team with a shared rubric and sample essays."
            sections={[
              {
                title: 'Prep content',
                body: <p>Add a rubric and upload a handful of representative essays first.</p>,
              },
              {
                title: 'Create a session',
                body: <p>Name the session, pick the rubric, and select up to 10 essays before creating.</p>,
              },
              {
                title: 'Mark together',
                body: <p>Open an essay, enter AO scores, and submit marks; repeat for each essay.</p>,
              },
              {
                title: 'Review agreement',
                body: <p>Use the stats section to spot variance across AO1–AO4 and discuss outliers.</p>,
              },
            ]}
          />
        </div>
        {initialLoading && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}
        {fetchError && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-semibold mb-1">Couldn’t load your data</div>
            <p className="mb-3">{fetchError}</p>
            <button onClick={loadInitial} className="px-3 py-1 rounded bg-red-600 text-white text-sm">Retry</button>
          </div>
        )}
        {showExplainer && (
          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold mb-1">What is Calibration?</div>
                <p className="mb-2">Calibration helps your team align on how a rubric is applied so students receive consistent, fair marks.</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Select a rubric and a short set of representative scripts.</li>
                  <li>Each marker scores the same scripts independently.</li>
                  <li>Review the agreement stats to spot drift and discuss outliers.</li>
                </ul>
                <p className="mt-2 text-blue-800">Tip: Use anonymised scripts and keep sets small (5–10) for focused discussion.</p>
              </div>
              <button
                aria-label="Dismiss explainer"
                className="shrink-0 rounded px-2 py-1 text-blue-900 hover:bg-blue-100"
                onClick={() => {
                  try { localStorage.setItem('calibrationExplainerDismissed', '1'); } catch {}
                  setShowExplainer(false);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {/* Empty State Guidance */}
        {!initialLoading && !fetchError && (rubrics.length === 0 || essays.length === 0) && (
          <div className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <div className="font-semibold mb-2">Get ready to calibrate</div>
            {rubrics.length === 0 && (
              <p className="mb-2">You’ll need a rubric first. Create one on the Rubrics page.</p>
            )}
            {essays.length === 0 && (
              <p className="mb-3">Add a few representative essays to include in your calibration set.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/rubrics" className="px-3 py-1.5 rounded bg-brand-600 text-white text-sm hover:bg-brand-700">Go to Rubrics</Link>
              <Link to="/essay-feedback" className="px-3 py-1.5 rounded border border-brand-600 text-brand-700 text-sm hover:bg-brand-50">Add Essays</Link>
            </div>
          </div>
        )}

        {/* Create Session */}
        <div className="bg-gray-50 border rounded p-4 mb-6">
          <h3 className="font-semibold mb-2">Create Calibration Session</h3>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Session Name</label>
              <input value={sessionName} onChange={e=>setSessionName(e.target.value)} className="border p-2 w-full" placeholder="e.g. Nov Mock Scripts" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rubric</label>
              <select aria-label="Rubric" value={sessionRubricId} onChange={e=>setSessionRubricId(e.target.value)} className="border p-2 w-full">
                <option value="">Select rubric…</option>
                {rubrics.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Select Essays (up to 10)</label>
              <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm space-y-1 bg-white">
                {essays.map(e => {
                  const checked = selectedEssayIds.includes(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedEssayIds(prev => checked ? prev.filter(id=>id!==e.id) : (prev.length<10 ? [...prev, e.id] : prev));
                        }}
                      />
                      <span>{e.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <button disabled={loading || rubrics.length===0 || essays.length===0} onClick={createSession} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
            {loading ? 'Creating…' : 'Create Session'}
          </button>
        </div>
        {/* Sessions List */}
        <div className="mb-8">
          <h3 className="font-semibold mb-2">Sessions</h3>
          <div className="space-y-2">
            {sessions.map(s => (
              <div key={s.id} className={`p-3 border rounded flex items-center justify-between ${activeSessionId===s.id ? 'bg-indigo-50' : 'bg-white'}`}> 
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-gray-600">{new Date(s.created_at).toLocaleDateString()} • {s.status}</div>
                </div>
                <button onClick={()=>{setActiveSessionId(s.id);}} className="text-sm text-indigo-600 hover:underline">Open</button>
              </div>
            ))}
            {sessions.length===0 && <p className="text-gray-500 text-sm">No sessions yet.</p>}
          </div>
        </div>
        {/* Marking Interface */}
        {activeSessionId && (
          <div className="border rounded p-4 bg-white mb-6">
            <h3 className="font-semibold mb-3">Mark Essays</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedEssayIds.map(id => {
                const essay = essays.find(e=>e.id===id);
                if (!essay) return null;
                return (
                  <button
                    key={id}
                    onClick={()=>openEssayForMarking(id)}
                    className={`px-3 py-1 rounded text-sm border ${currentEssayId===id ? 'bg-indigo-600 text-white' : 'bg-gray-50 hover:bg-gray-100'}`}
                  >{essay.title}</button>
                );
              })}
            </div>
            {!currentEssayId && <p className="text-gray-500 text-sm">Select an essay above to begin marking.</p>}
            {currentEssayId && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="border rounded p-3 bg-gray-50">
                    <h4 className="font-medium mb-2">Essay Content</h4>
                    <div className="text-sm whitespace-pre-wrap max-h-72 overflow-y-auto">{essays.find(e=>e.id===currentEssayId)?.content}</div>
                  </div>
                  <div className="border rounded p-3 bg-gray-50">
                    <h4 className="font-medium mb-2">Submit Your Scores</h4>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {(['ao1','ao2','ao3','ao4'] as const).map(k => (
                        <div key={k} className="flex flex-col">
                          <label className="text-xs font-semibold uppercase">{k}</label>
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={scores[k]}
                            onChange={e=>setScores(prev=>({ ...prev, [k]: Number(e.target.value) }))}
                            className="border p-1 rounded text-sm"
                            aria-label={`Score ${k.toUpperCase()}`}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                    <button onClick={submitMark} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Submit Mark</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="border rounded p-3 bg-gray-50">
                    <h4 className="font-medium mb-2">Current Marks (This Essay)</h4>
                    {marks.length === 0 && <p className="text-xs text-gray-500">No marks yet.</p>}
                    {marks.length > 0 && (
                      <table className="w-full text-xs border">
                        <thead>
                          <tr className="bg-white">
                            <th className="border p-1">Marker</th>
                            <th className="border p-1">AO1</th>
                            <th className="border p-1">AO2</th>
                            <th className="border p-1">AO3</th>
                            <th className="border p-1">AO4</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marks.map(m => (
                            <tr key={m.id} className="odd:bg-white even:bg-gray-100">
                              <td className="border p-1">{m.marker_id.slice(0,8)}</td>
                              <td className="border p-1">{m.scores.ao1}</td>
                              <td className="border p-1">{m.scores.ao2}</td>
                              <td className="border p-1">{m.scores.ao3}</td>
                              <td className="border p-1">{m.scores.ao4}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="border rounded p-3 bg-gray-50">
                    <h4 className="font-medium mb-2">Agreement Stats</h4>
                    {!stats && <p className="text-xs text-gray-500">No data yet.</p>}
                    {stats && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(stats).map(([ao, obj]) => (
                          <div key={ao} className="p-2 bg-white rounded border">
                            <div className="font-semibold uppercase">{ao}</div>
                            <div>Avg: {obj.avg.toFixed(1)}</div>
                            <div>SD: {obj.sd.toFixed(2)}</div>
                            <div className="text-gray-500">n={obj.values.length}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default Calibration;
