import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import notify from '../utils/notify';
import Navbar from '../components/Navbar';
import ErrorBoundary from '../components/ErrorBoundary';
import ConfirmModal from '../components/ConfirmModal';

interface Student {
  id: string;
  name: string;
  email: string;
  grade: string;
  class_section: string;
  student_id: string;
  active: boolean;
  notes: string;
}

function Students() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Student, 'id'>>({
    name: '',
    email: '',
    grade: '',
    class_section: '',
    student_id: '',
    active: true,
    notes: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      loadStudents(mounted);
    }
    return () => { mounted = false; };
  }, [user]);

  const loadStudents = async (mounted = true) => {
    try {
      setLoading(true);
      // Timeout protection for maintenance/downtime (increased to 30s for cold starts)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out - Supabase may be under maintenance')), 30000)
      );
      const fetchPromise = supabase
        .from('students')
        .select('*')
        .eq('teacher_id', user!.id)
        .order('name');
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (!mounted) return;

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      if (!mounted) return;
      
      const isTimeout = error.message === 'Request timed out - Supabase may be under maintenance';
      
      if (isTimeout) {
        console.warn('Students load timed out (likely cold start)');
      } else {
        console.error('Error loading students:', error);
        notify.error(`Failed to load students: ${error.message || 'Unknown error'}`);
      }
      setStudents([]); // Clear to empty state instead of hanging
    } finally {
      if (mounted) setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target;
    const { name, value } = target;
    
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: target.checked }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setForm({ 
      name: '', 
      email: '', 
      grade: '', 
      class_section: '', 
      student_id: '', 
      active: true, 
      notes: '' 
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      notify.error('You must be logged in');
      return;
    }

    try {
      setSaving(true);
      
      if (editingId === null) {
        // Create new student
        const { data, error } = await supabase
          .from('students')
          .insert([{
            teacher_id: user.id,
            name: form.name,
            email: form.email,
            grade: form.grade,
            class_section: form.class_section,
            student_id: form.student_id,
            active: form.active,
            notes: form.notes,
          }])
          .select()
          .single();

        if (error) throw error;
        setStudents(prev => [...prev, data]);
        notify.success('Student added successfully');
      } else {
        // Update existing student
        const { data, error } = await supabase
          .from('students')
          .update({
            name: form.name,
            email: form.email,
            grade: form.grade,
            class_section: form.class_section,
            student_id: form.student_id,
            active: form.active,
            notes: form.notes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;
        setStudents(prev => prev.map(s => (s.id === editingId ? data : s)));
        notify.success('Student updated successfully');
      }
      
      resetForm();
    } catch (error: any) {
      console.error('Error saving student:', error);
      notify.error(editingId ? 'Failed to update student' : 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (id: string) => {
    const student = students.find(s => s.id === id);
    if (!student) return;
    const { id: _id, ...rest } = student;
    setForm(rest);
    setEditingId(id);
  };

  const openDeleteModal = (id: string) => {
    setStudentToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;

    try {
      // Check if student has any essays
      const { data: essays, error: essaysError } = await supabase
        .from('essays')
        .select('id')
        .eq('student_id', studentToDelete)
        .limit(1);

      if (essaysError) throw essaysError;

      if (essays && essays.length > 0) {
        notify.error('Cannot delete student: they have existing essays. Delete those essays first or set student as inactive.');
        setDeleteModalOpen(false);
        setStudentToDelete(null);
        return;
      }

      // Safe to delete
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentToDelete);

      if (error) throw error;
      
      setStudents(prev => prev.filter(s => s.id !== studentToDelete));
      if (editingId === studentToDelete) resetForm();
      notify.success('Student deleted successfully');
      setDeleteModalOpen(false);
      setStudentToDelete(null);
    } catch (error: any) {
      console.error('Error deleting student:', error);
      notify.error(`Failed to delete student: ${error.message || 'Unknown error'}`);
      setDeleteModalOpen(false);
      setStudentToDelete(null);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      notify.error('Please upload a CSV file');
      return;
    }
    
    try {
      setImporting(true);
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      
      if (lines.length < 2) {
        notify.error('CSV file is empty or invalid');
        return;
      }
      
      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = headers.findIndex(h => h === 'name');
      const emailIndex = headers.findIndex(h => h === 'email');
      const gradeIndex = headers.findIndex(h => h === 'grade' || h === 'grade level');
      const sectionIndex = headers.findIndex(h => h.includes('section') || h.includes('class'));
      const studentIdIndex = headers.findIndex(h => h.includes('student') && h.includes('id'));
      const notesIndex = headers.findIndex(h => h === 'notes');
      
      if (nameIndex === -1 || emailIndex === -1) {
        notify.error('CSV must have "name" and "email" columns');
        return;
      }
      
      // Parse rows
      const studentsToImport = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        
        if (cols.length < 2 || !cols[nameIndex] || !cols[emailIndex]) {
          continue; // Skip invalid rows
        }
        
        studentsToImport.push({
          teacher_id: user!.id,
          name: cols[nameIndex],
          email: cols[emailIndex],
          grade: gradeIndex !== -1 ? cols[gradeIndex] || '' : '',
          class_section: sectionIndex !== -1 ? cols[sectionIndex] || '' : '',
          student_id: studentIdIndex !== -1 ? cols[studentIdIndex] || '' : '',
          active: true,
          notes: notesIndex !== -1 ? cols[notesIndex] || '' : '',
        });
      }
      
      if (studentsToImport.length === 0) {
        notify.error('No valid student records found in CSV');
        return;
      }
      
      // Bulk insert
      const { data, error } = await supabase
        .from('students')
        .insert(studentsToImport)
        .select();
      
      if (error) throw error;
      
      setStudents(prev => [...prev, ...(data || [])]);
      notify.success(`Successfully imported ${studentsToImport.length} students`);
    } catch (error: any) {
      console.error('CSV import error:', error);
      notify.error('Failed to import CSV: ' + (error.message || 'Unknown error'));
    } finally {
      setImporting(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  const downloadCsvTemplate = () => {
    const template = 'name,email,grade,class section,student id,notes\nJohn Doe,john@example.com,10,A,S001,Good student\nJane Smith,jane@example.com,10,B,S002,';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Navbar />
      <ErrorBoundary>
      {loading ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Students Manager</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage your students and track their essay submissions</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={downloadCsvTemplate}
              className="bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-700 font-medium flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">Download CSV Template</span>
              <span className="sm:hidden">CSV Template</span>
            </button>
            <label className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 font-medium cursor-pointer flex items-center justify-center gap-2 text-sm">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {importing ? 'Importing...' : 'Import CSV'}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvImport}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          className="bg-white rounded-lg shadow-md p-6 mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {editingId === null ? 'Add New Student' : 'Edit Student'}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Student name"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="student@email.com (optional)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="grade"
                value={form.grade}
                onChange={handleChange}
                placeholder="e.g., 10, Year 10"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Section</label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="class_section"
                value={form.class_section}
                onChange={handleChange}
                placeholder="e.g., A, B1, English 101"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Student ID</label>
              <input
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="student_id"
                value={form.student_id}
                onChange={handleChange}
                placeholder="Unique student ID"
              />
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={handleChange}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">Active Student</span>
              </label>
            </div>
            
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Additional notes about the student"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button 
              type="submit" 
              disabled={saving}
              className="bg-purple-600 text-white py-2 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : (editingId === null ? 'Add Student' : 'Update Student')}
            </button>
            {editingId !== null && (
              <button 
                type="button" 
                onClick={resetForm} 
                className="bg-gray-400 text-white py-2 px-6 rounded-lg hover:bg-gray-500 font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Name</th>
                  <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Email</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Grade</th>
                  <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Section</th>
                  <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Student ID</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs mr-3">
                          {getInitials(s.name)}
                        </div>
                        {s.name}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{s.email}</td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{s.grade || '-'}</td>
                    <td className="hidden lg:table-cell px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{s.class_section || '-'}</td>
                    <td className="hidden xl:table-cell px-3 sm:px-4 py-3 text-xs sm:text-sm text-gray-600">{s.student_id || '-'}</td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm">
                      {s.active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm">
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button 
                          onClick={() => handleEdit(s.id)} 
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => openDeleteModal(s.id)} 
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <svg
                          className="w-12 h-12 text-gray-400 mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                        <p className="text-gray-600 font-medium">No students added yet</p>
                        <p className="text-sm text-gray-500 mt-1 mb-3">Add your first student using the form above</p>
                        <button
                          onClick={loadStudents}
                          className="text-sm text-blue-600 hover:text-blue-700 underline"
                        >
                          Retry loading students
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}
      </ErrorBoundary>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student? This action cannot be undone and will remove all associated data."
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

export default Students;