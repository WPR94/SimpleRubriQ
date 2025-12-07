import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const CheckoutSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Get redirect URL from session storage
    const redirectUrl = sessionStorage.getItem('post_payment_redirect');
    const targetUrl = redirectUrl || '/dashboard';
    
    // Clear the stored redirect
    sessionStorage.removeItem('post_payment_redirect');

    const timer = setTimeout(() => {
      navigate(targetUrl);
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Payment Successful!</h2>
          <p className="mt-4 text-lg text-gray-600">
            Your subscription is now active. You have full access to all Pro features.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Redirecting you back in 3 seconds...
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-8 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Go to Dashboard Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
