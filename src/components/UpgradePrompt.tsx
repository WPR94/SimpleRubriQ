import { Link } from 'react-router-dom';

interface UpgradePromptProps {
  feature: string;
  description?: string;
}

export const UpgradePrompt = ({ feature, description }: UpgradePromptProps) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-4">
            <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade to Access {feature}
          </h3>
          <p className="text-gray-600 mb-6">
            {description || `${feature} is available on our Teacher Pro plan. Upgrade now to unlock unlimited features and save hours of marking time.`}
          </p>
          <div className="space-y-3">
            <Link
              to={`/pricing?redirect=${encodeURIComponent(window.location.pathname)}`}
              className="block w-full bg-indigo-600 text-white rounded-lg py-3 px-6 font-semibold hover:bg-indigo-700 transition"
            >
              View Plans & Upgrade
            </Link>
            <button
              onClick={() => window.history.back()}
              className="block w-full bg-gray-100 text-gray-700 rounded-lg py-3 px-6 font-semibold hover:bg-gray-200 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
