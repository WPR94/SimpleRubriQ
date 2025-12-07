import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../hooks/usePlan';
import Logo from './Logo';
import { 
  Bars3Icon, 
  XMarkIcon, 
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

export default function Navbar() {
  const { user, signOut, profile } = useAuth();
  const { plan, isLoading } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef<Set<string>>(new Set());

  const getPlanBadge = () => {
    if (isLoading) return null;
    if (plan === 'teacher_pro') return { text: 'Pro', color: 'bg-indigo-600' };
    if (plan === 'teacher_pro_plus') return { text: 'Pro+', color: 'bg-purple-600' };
    if (plan === 'school') return { text: 'School', color: 'bg-green-600' };
    return { text: 'Free', color: 'bg-gray-500' };
  };

  const planBadge = getPlanBadge();

  const routePrefetchers: Record<string, () => Promise<unknown>> = {
    '/dashboard': () => import('../pages/Dashboard'),
    '/rubrics': () => import('../pages/Rubrics'),
    '/students': () => import('../pages/Students'),
    '/essay-feedback': () => import('../pages/EssayFeedback'),
    '/feedback-history': () => import('../pages/FeedbackHistory'),
    '/analytics': () => import('../pages/Analytics'),
    '/batch': () => import('../pages/BatchProcessor'),
    '/calibration': () => import('../pages/Calibration'),
    '/demo': () => import('../pages/Demo'),
    '/dashboard-demo': () => import('../pages/DashboardDemo'),
    '/about': () => import('../pages/About'),
    '/privacy': () => import('../pages/Privacy'),
    '/terms': () => import('../pages/Terms'),
    '/dpa': () => import('../pages/DataProcessingAgreement'),
    '/account': () => import('../pages/AccountSettings'),
    '/admin': () => import('../pages/AdminDashboard'),
    '/admin/users': () => import('../pages/AdminUsers'),
    '/admin/analytics': () => import('../pages/AdminAnalytics'),
    '/admin/activity': () => import('../pages/AdminActivityLogs'),
  };

  const prefetchRoute = (path: string) => {
    if (prefetched.current.has(path)) return;
    const loader = routePrefetchers[path];
    if (loader) {
      prefetched.current.add(path);
      loader().catch(() => prefetched.current.delete(path));
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Rubrics', path: '/rubrics' },
    { name: 'Students', path: '/students' },
    { name: 'Essay Feedback', path: '/essay-feedback' },
    { name: 'Analytics', path: '/analytics' },
    { name: 'Batch', path: '/batch' },
  ];

  const publicLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
    { name: 'Pricing', path: '/pricing' },
  ];

  const linksToShow = user ? navLinks : publicLinks;

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Desktop Nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to={user ? "/dashboard" : "/"}>
                <Logo className="h-8 w-auto" />
              </Link>
            </div>
            <div className="hidden md:ml-6 md:flex md:space-x-4 items-center">
              {linksToShow.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onMouseEnter={() => prefetchRoute(link.path)}
                    onFocus={() => prefetchRoute(link.path)}
                    className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Side: Profile & Mobile Menu Button */}
          <div className="flex items-center">
            {user ? (
              /* Profile Dropdown */
              <div className="hidden md:ml-4 md:flex md:items-center">
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                      {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email?.[0].toUpperCase()}
                    </div>
                  </button>

                  {isProfileOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
                        {planBadge && (
                          <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium text-white ${planBadge.color}`}>
                            {planBadge.text}
                          </span>
                        )}
                      </div>
                      {plan === 'free' && (
                        <Link
                          to="/pricing"
                          className="block px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          ⭐ Upgrade to Pro
                        </Link>
                      )}
                      <Link
                        to="/account"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <div className="flex items-center">
                          <Cog6ToothIcon className="mr-2 h-4 w-4" />
                          Settings
                        </div>
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        <div className="flex items-center">
                          <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                          Sign out
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:ml-4 md:flex md:items-center space-x-4">
                <Link
                  to="/auth"
                  className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-white font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/auth"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="-mr-2 flex items-center md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="pt-2 pb-3 space-y-1 px-2">
            {linksToShow.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  onMouseEnter={() => prefetchRoute(link.path)}
                  onFocus={() => prefetchRoute(link.path)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
          <div className="pt-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            {user ? (
              <>
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-lg border border-blue-200 dark:border-blue-800">
                      {profile?.full_name ? profile.full_name[0].toUpperCase() : user?.email?.[0].toUpperCase()}
                    </div>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800 dark:text-white">
                      {profile?.full_name || 'Teacher'}
                    </div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user?.email}</div>
                  </div>
                </div>
                <div className="mt-3 px-2 space-y-1">
                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="px-5 space-y-3">
                <Link
                  to="/auth"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Get Started
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-base font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
