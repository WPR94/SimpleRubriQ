import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';

function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Non-blocking connection check in background
    async function checkConnection() {
      try {
        const { data, error } = await supabase.auth.getSession();
        console.log('Supabase connection check:', { data, error });
        if (error) console.warn('Supabase check failed (non-blocking):', error);
      } catch (e) {
        console.error('Supabase connection error (non-blocking):', e);
      }
    }
    checkConnection();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white flex flex-col">
      {/* Navbar */}
      <nav className="w-full bg-white/10 backdrop-blur-md shadow-lg border-b border-white/20">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center group" aria-label="Simple Rubriq Home">
            <Logo className="h-8 sm:h-10 text-white transition-transform group-hover:scale-105" variant="mono" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link 
              to="/about" 
              className="px-4 py-2 text-white hover:text-blue-100 font-medium transition-colors duration-200"
            >
              About
            </Link>
            <Link 
              to="/auth" 
              className="px-6 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/10 backdrop-blur-md border-t border-white/20">
            <div className="container mx-auto px-4 py-4 flex flex-col space-y-3">
              <Link 
                to="/about" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-white hover:bg-white/10 rounded-lg font-medium transition-colors duration-200"
              >
                About
              </Link>
              <Link 
                to="/auth" 
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-200 text-center"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-5xl w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-xs sm:text-sm font-medium mb-6 sm:mb-8 border border-white/30">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            AI-Powered Essay Grading
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 leading-tight px-2">
            Mark smarter,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">
              not harder
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-2xl text-blue-100 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
            AI-powered rubric grading that saves hours on marking while delivering 
            structured, consistent feedback students actually understand.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4">
            <Link 
              to="/auth" 
              className="px-6 sm:px-8 py-3 sm:py-4 bg-white text-blue-600 rounded-lg font-bold text-base sm:text-lg hover:bg-blue-50 transition-all duration-200 shadow-2xl hover:shadow-3xl hover:scale-105"
            >
              Start Free Trial →
            </Link>
            <Link 
              to="/about" 
              className="px-6 sm:px-8 py-3 sm:py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-lg font-bold text-base sm:text-lg hover:bg-white/20 transition-all duration-200"
            >
              Learn More
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 sm:mt-20 px-4">
            {/* Card 1 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">10x Faster</h3>
              <p className="text-blue-100">
                Grade essays in seconds instead of hours. AI analyzes work against your rubric automatically.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-16 h-16 bg-green-400 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">100% Consistent</h3>
              <p className="text-blue-100">
                Every essay graded fairly with the same rubric standards. No more marking fatigue bias.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-16 h-16 bg-purple-400 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">Better Feedback</h3>
              <p className="text-blue-100">
                Structured, actionable feedback that helps students improve. Aligned to your teaching goals.
              </p>
            </div>
          </div>

          {/* Social Proof Section */}
          <div className="mt-20 px-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Trusted by Educators</h3>
                <p className="text-blue-100">Join thousands of teachers saving hours every week</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">10,000+</div>
                  <div className="text-blue-100">Essays Graded</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">500+</div>
                  <div className="text-blue-100">Active Teachers</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2">95%</div>
                  <div className="text-blue-100">Satisfaction Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-12 px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-blue-100 mb-4 italic">
                  "Simple Rubriq has transformed how I grade essays. What used to take me 3 hours now takes 20 minutes. The feedback is detailed and consistent."
                </p>
                <p className="font-semibold">Sarah M.</p>
                <p className="text-blue-200 text-sm">English Teacher, London</p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <div className="flex items-center mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-blue-100 mb-4 italic">
                  "The custom rubrics feature is brilliant. I can grade exactly to my marking criteria, and the AI never gets tired or inconsistent."
                </p>
                <p className="font-semibold">James T.</p>
                <p className="text-blue-200 text-sm">History Teacher, Manchester</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-8 bg-white/5 backdrop-blur-sm border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <p className="text-white/90 text-sm sm:text-base text-center">© 2025 Simple Rubriq. Built with ❤️ for teachers.</p>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs sm:text-sm">
              <Link to="/privacy" className="text-white/80 hover:text-white transition-colors">Privacy Policy</Link>
              <span className="hidden sm:inline text-white/40">|</span>
              <Link to="/terms" className="text-white/80 hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;