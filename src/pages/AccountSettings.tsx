import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import ConfirmModal from '../components/ConfirmModal';
import Navbar from '../components/Navbar';
import { notify } from '../utils/notify';

export default function AccountSettings() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(() => {
    return localStorage.getItem('simple-rubriq-session-timeout') || '30';
  });

  // Update profile information
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      // Use upsert to handle both update and create cases
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          user_id: user.id, // Redundant but required by some schema versions
          email: user.email,
          full_name: fullName, 
          updated_at: new Date().toISOString() 
        });

      if (error) throw error;
      notify.success('Profile updated successfully');
      await refreshProfile(); 
    } catch (error: any) {
      console.error('Profile update error:', error);
      notify.error(`Failed to update profile: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Export all user data (GDPR Article 20 - Right to Data Portability)
  const handleExportData = async () => {
    setLoading(true);
    try {
      // Fetch all user data
      const [studentsRes, rubricsRes, essaysRes] = await Promise.all([
        supabase.from('students').select('*').eq('teacher_id', user?.id),
        supabase.from('rubrics').select('*').eq('teacher_id', user?.id),
        supabase.from('essays').select('*, feedback(*)').eq('teacher_id', user?.id),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        user: {
          id: user?.id,
          email: user?.email,
          createdAt: user?.created_at,
        },
        students: studentsRes.data || [],
        rubrics: rubricsRes.data || [],
        essays: essaysRes.data || [], // Includes feedback nested
      };

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `simple-rubriq-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notify.success('Your data has been exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      notify.error('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete account and all data (GDPR Article 17 - Right to Erasure)
  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      // Delete all related data (cascade delete via foreign keys)
      // Note: Deleting essays will cascade to feedback
      await Promise.all([
        supabase.from('essays').delete().eq('teacher_id', user?.id),
        supabase.from('rubrics').delete().eq('teacher_id', user?.id),
        supabase.from('students').delete().eq('teacher_id', user?.id),
      ]);

      // Delete user account
      const { error } = await supabase.rpc('delete_user');
      
      if (error) throw error;

      notify.success('Your account has been deleted');
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Delete error:', error);
      notify.error('Failed to delete account. Please contact support.');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  // Update session timeout preference
  const handleSessionTimeoutChange = (value: string) => {
    setSessionTimeout(value);
    localStorage.setItem('simple-rubriq-session-timeout', value);
    notify.success(`Session timeout set to ${value} minutes`);
  };

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
        </div>

      {/* Account Information */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Account Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleUpdateProfile}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
            <p className="text-gray-900 dark:text-white">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Account Created</label>
            <p className="text-gray-900 dark:text-white">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>
      </section>

      {/* Security Settings */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Security Settings
        </h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Session Timeout (minutes)
          </label>
          <select
            aria-label="Session timeout duration"
            value={sessionTimeout}
            onChange={(e) => handleSessionTimeoutChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Automatically log out after this period of inactivity
          </p>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          To change your password, please sign out and use the "Forgot Password" option on the login page.
        </p>
      </section>

      {/* Privacy & Data Rights (GDPR) */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Privacy & Data Rights
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Under UK GDPR, you have the right to access, export, and delete your personal data.
        </p>

        {/* Export Data */}
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            📥 Export Your Data
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Download all your data including students, rubrics, and feedback history in JSON format.
          </p>
          <button
            onClick={handleExportData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Exporting...' : 'Export All Data'}
          </button>
        </div>

        {/* Delete Account */}
        <div>
          <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">
            🗑️ Delete Account
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </section>

      {/* Consent Management */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Consent & Preferences
        </h2>
        <div className="space-y-3">
          <label className="flex items-start">
            <input
              type="checkbox"
              defaultChecked
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">
              <strong>Email Notifications</strong>
              <br />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Receive notifications when feedback is generated
              </span>
            </span>
          </label>
          <label className="flex items-start">
            <input
              type="checkbox"
              defaultChecked
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-gray-700 dark:text-gray-300">
              <strong>Product Updates</strong>
              <br />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Receive occasional updates about new features
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* Confirmation Modal for Account Deletion */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you absolutely sure? This will permanently delete your account, all students, rubrics, and feedback. This action cannot be undone."
        confirmText="Delete Everything"
        type="danger"
      />
      </div>
    </>
  );
}
