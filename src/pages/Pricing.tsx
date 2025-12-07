import Navbar from '../components/Navbar';
import { useEffect } from 'react';

const PricingPage = () => {
  useEffect(() => {
    // Load Stripe pricing table script
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Choose the plan that's right for you
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Simple, transparent pricing. No hidden fees.
          </p>
        </div>

        {/* @ts-ignore - Stripe pricing table custom element */}
        <stripe-pricing-table 
          pricing-table-id="prctbl_1SbnKvG6PuTLNlfEyhiOttVD"
          publishable-key="pk_test_51SblnqG6PuTLNlfEo6USLREiIPx20yi9dBcQ402eU9oVeyffteoU8r3ynGAezYybEvdZbpHG5vQviCk4GmwidlP5001h1cp2cc"
        />
      </div>
    </div>
  );
};

export default PricingPage;
