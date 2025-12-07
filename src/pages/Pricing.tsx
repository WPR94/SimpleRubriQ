import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const PricingPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const redirectTo = searchParams.get('redirect');

  const handleFreeTier = () => {
    if (!user) {
      navigate('/auth?plan=free');
    } else {
      navigate(redirectTo || '/dashboard');
    }
  };

  const handleProUpgrade = async (tier: 'teacher_pro' | 'teacher_pro_plus') => {
    if (!user) {
      navigate(`/auth?plan=${tier}`);
      return;
    }

    setLoading(tier);
    try {
      if (redirectTo) {
        sessionStorage.setItem('post_payment_redirect', redirectTo);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        'https://hyovomyhoxhvhogfvupj.supabase.co/functions/v1/create-checkout',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ plan: tier }),
        }
      );

      if (!res.ok) throw new Error('Failed to create checkout session');

      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(null);
    }
  };

  const currentPlan = profile?.plan || 'free';

  return (
    <div className="bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Choose the plan that fits your needs. Upgrade, downgrade, or cancel anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* FREE TIER */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:border-blue-300 transition-all">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Free</h3>
              <div className="mt-4">
                <span className="text-5xl font-extrabold text-gray-900">£0</span>
                <span className="text-gray-500 ml-2">/forever</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Perfect for trying it out</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">5 AI Feedback Runs/month</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Up to 3 Rubrics</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Up to 10 Students</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Standard AI Model</span>
              </li>
            </ul>

            <button
              onClick={handleFreeTier}
              disabled={currentPlan === 'free'}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                currentPlan === 'free'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-800 text-white hover:bg-gray-900'
              }`}
            >
              {currentPlan === 'free' ? 'Current Plan' : 'Get Started Free'}
            </button>
          </div>

          {/* TEACHER PRO */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-2xl p-8 text-white relative transform lg:scale-105 border-4 border-blue-400">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold">
              MOST POPULAR
            </div>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold">Teacher Pro</h3>
              <div className="mt-4">
                <span className="text-5xl font-extrabold">£9.99</span>
                <span className="opacity-90 ml-2">/month</span>
              </div>
              <p className="mt-2 text-sm opacity-90">Everything you need</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Unlimited AI Feedback</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Unlimited Rubrics & Students</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Advanced AI (GPT-4o)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Dashboard & Analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>PDF/DOCX Exports</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span>Priority Support</span>
              </li>
            </ul>

            <button
              onClick={() => handleProUpgrade('teacher_pro')}
              disabled={loading === 'teacher_pro' || currentPlan === 'teacher_pro' || currentPlan === 'teacher_pro_plus'}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                currentPlan === 'teacher_pro' || currentPlan === 'teacher_pro_plus'
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-white text-blue-700 hover:bg-blue-50'
              }`}
            >
              {loading === 'teacher_pro' ? (
                'Loading...'
              ) : currentPlan === 'teacher_pro' ? (
                'Current Plan ✓'
              ) : currentPlan === 'teacher_pro_plus' ? (
                'Downgrade'
              ) : (
                'Upgrade to Pro'
              )}
            </button>
          </div>

          {/* TEACHER PRO+ */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-purple-200 hover:border-purple-400 transition-all">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Teacher Pro+</h3>
              <div className="mt-4">
                <span className="text-5xl font-extrabold text-gray-900">£17.99</span>
                <span className="text-gray-500 ml-2">/month</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">For power users</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Everything in Pro</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Batch Grading (30 essays)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">LMS Integration</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Advanced Analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Custom Comment Bank</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Early Access Features</span>
              </li>
            </ul>

            <button
              onClick={() => handleProUpgrade('teacher_pro_plus')}
              disabled={loading === 'teacher_pro_plus' || currentPlan === 'teacher_pro_plus'}
              className={`w-full py-3 px-6 rounded-lg font-semibold transition-all ${
                currentPlan === 'teacher_pro_plus'
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {loading === 'teacher_pro_plus' ? (
                'Loading...'
              ) : currentPlan === 'teacher_pro_plus' ? (
                'Current Plan ✓'
              ) : (
                'Upgrade to Pro+'
              )}
            </button>
          </div>

          {/* SCHOOLS */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200 hover:border-gray-400 transition-all">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Schools</h3>
              <div className="mt-4">
                <span className="text-3xl font-extrabold text-gray-900">Custom</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Starting from £350/year</p>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Everything in Pro+</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Centralized Billing</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Admin Dashboard</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Shared Rubric Library</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Dedicated Support</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-700">Compliance & Data Agreements</span>
              </li>
            </ul>

            <a
              href="mailto:sales@simplerubriq.com?subject=School Plan Inquiry"
              className="block w-full py-3 px-6 rounded-lg font-semibold text-center bg-gray-800 text-white hover:bg-gray-900 transition-all"
            >
              Contact Sales
            </a>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-16 text-center space-y-4">
          <div className="flex items-center justify-center gap-6 flex-wrap text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>14-day money-back guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Secure payment via Stripe</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl mx-auto">
            All plans include UK GDPR compliance, data encryption, and regular backups. Your payment information is never stored on our servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
