import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import notify from '../utils/notify';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import { 
  validatePasswordStrength, 
  getPasswordStrengthLabel, 
  getPasswordStrengthColor 
} from '../utils/passwordStrength';

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Password strength state
  const passwordStrength = isSignUp ? validatePasswordStrength(password) : null;

  // Handle email confirmation and redirect
  useEffect(() => {
    // Check for email confirmation token in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'signup') {
      notify.success('Email verified! Redirecting to dashboard...');
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    setError(null);
  }, [email, password]);

  const handleSignUp = async () => {
    // Validate terms acceptance
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy');
      notify.error('You must accept the terms to continue');
      return;
    }

    // Validate password strength before signup
    if (passwordStrength && !passwordStrength.isValid) {
      setError('Please choose a stronger password');
      notify.error('Password does not meet security requirements');
      return;
    }

    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      notify.error(error.message);
    } else {
      notify.success('Check your email to confirm your account');
      setIsSignUp(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      notify.error(error.message);
    } else {
      notify.success('Welcome back!');
      navigate('/dashboard');
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address');
      notify.error('Email is required for password reset');
      return;
    }

    setLoading(true);
    setError(null);
    // Use production URL if available, fallback to current origin
    const redirectUrl = import.meta.env.PROD 
      ? 'https://simplerubriq-git-main-wpr94s-projects.vercel.app/auth?reset=true'
      : `${window.location.origin}/auth?reset=true`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    setLoading(false);
    
    if (error) {
      setError(error.message);
      notify.error(error.message);
    } else {
      setResetEmailSent(true);
      notify.success('Password reset email sent! Check your inbox.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordReset) {
      handlePasswordReset();
    } else if (isSignUp) {
      handleSignUp();
    } else {
      handleSignIn();
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding & Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 flex-col justify-between text-white">
        <div>
          <Link to="/" className="inline-block mb-12">
            <Logo className="h-10 text-white" variant="mono" />
          </Link>
          <h1 className="text-4xl font-bold mb-6">
            Save hours grading.<br />Focus on teaching.
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Grade essays against your own rubrics with AI-powered feedback that's fast, fair, and consistent.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full p-2 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Save 70% of marking time</h3>
                <p className="text-blue-200 text-sm">Grade essays in minutes, not hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full p-2 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Consistent, rubric-aligned feedback</h3>
                <p className="text-blue-200 text-sm">AI ensures fair grading across all students</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-blue-500 rounded-full p-2 mt-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Detailed analytics & insights</h3>
                <p className="text-blue-200 text-sm">Track student progress over time</p>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-blue-100 text-sm">
          <p className="mt-2">© 2025 Simple Rubriq. All rights reserved.</p>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link to="/" className="inline-block">
              <Logo className="h-8 sm:h-10 mx-auto transition-transform hover:scale-105" />
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {isPasswordReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="text-gray-600">
                {isPasswordReset
                  ? 'Enter your email to receive a password reset link'
                  : isSignUp 
                  ? 'Sign up to start grading smarter' 
                  : 'Sign in to your teacher account'}
              </p>
            </div>

            {user && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✓ Currently signed in as <span className="font-semibold">{user.email}</span>
                </p>
                <button
                  onClick={async () => { 
                    await signOut(); 
                    notify.success('Signed out successfully'); 
                  }}
                  className="mt-2 text-sm text-green-700 hover:text-green-900 underline"
                >
                  Sign out
                </button>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {resetEmailSent && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✓ Password reset email sent! Check your inbox and spam folder.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="teacher@school.edu"
                  required
                  className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-gray-900 font-medium placeholder-gray-500"
                />
              </div>

              {!isPasswordReset && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white text-gray-900 font-medium placeholder-gray-500"
                  />
                
                {/* Password Strength Indicator (only show during signup) */}
                {isSignUp && password.length > 0 && passwordStrength && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Password Strength:</span>
                      <span className={`text-xs font-semibold ${
                        passwordStrength.score <= 1 ? 'text-red-600' :
                        passwordStrength.score === 2 ? 'text-yellow-600' :
                        passwordStrength.score === 3 ? 'text-blue-600' :
                        'text-green-600'
                      }`}>
                        {getPasswordStrengthLabel(passwordStrength.score)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength.score)}`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs space-y-1">
                        {passwordStrength.feedback.map((tip, idx) => (
                          <li key={idx} className={tip.includes('Strong') ? 'text-green-600' : 'text-gray-600'}>
                            {tip.includes('Strong') ? '✓' : '•'} {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                </div>
              )}

              {isSignUp && (
                <div className="flex items-start">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-600">
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" target="_blank" className="text-blue-600 hover:text-blue-700 font-medium">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              )}

              {!isSignUp && !isPasswordReset && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2" />
                    <span className="text-gray-600">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordReset(true);
                      setError(null);
                      setResetEmailSent(false);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (isSignUp && !acceptedTerms)}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{isPasswordReset ? 'Sending...' : isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                  </span>
                ) : (
                  isPasswordReset ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              {isPasswordReset ? (
                <p className="text-gray-600 text-sm">
                  Remember your password?{' '}
                  <button
                    onClick={() => {
                      setIsPasswordReset(false);
                      setError(null);
                      setResetEmailSent(false);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-gray-600 text-sm">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    onClick={() => {
                      setIsSignUp(!isSignUp);
                      setError(null);
                      setAcceptedTerms(false);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold"
                  >
                    {isSignUp ? 'Sign in' : 'Sign up'}
                  </button>
                </p>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <Link
                to="/"
                className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to home
              </Link>
            </div>
          </div>

          {/* Demo Account Info */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Demo Account:</span> Try it with test credentials or create your own account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Auth;