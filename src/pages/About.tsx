import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            Simplify grading. <span className="text-blue-600">Amplify teaching.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300">
            Simple Rubriq is an AI-powered grading assistant that helps teachers save time and improve feedback quality by aligning comments directly to your rubric criteria.
          </p>
        </div>
      </div>

      {/* Mission Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
          <p className="max-w-3xl mx-auto text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            We believe teachers shouldn't have to choose between speed and quality when marking essays. 
            Our mission is to make grading smarter, fairer, and more consistent, while keeping the human 
            touch that makes great teaching meaningful. Teachers deserve tools that respect their 
            expertise and free up time for what really matters: connecting with students.
          </p>
        </div>

        {/* How It Works Grid */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Upload',
                desc: 'Paste text or upload essays (PDF, DOCX) directly into the platform.',
                icon: (
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )
              },
              {
                step: '02',
                title: 'Configure',
                desc: 'Select your rubric or use our templates to set grading criteria.',
                icon: (
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )
              },
              {
                step: '03',
                title: 'Analyze',
                desc: 'Get instant, AI-powered feedback aligned specifically to your rubric.',
                icon: (
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )
              },
              {
                step: '04',
                title: 'Review',
                desc: 'Edit, personalize, and save the feedback to track student progress.',
                icon: (
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }
            ].map((item, index) => (
              <div key={index} className="relative p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="absolute -top-4 left-6 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-3 py-1 rounded-full text-sm border border-blue-100 dark:border-blue-800">
                  Step {item.step}
                </div>
                <div className="mt-4 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg w-fit">
                  {item.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Why Teachers Love It */}
        <div className="bg-blue-50 dark:bg-gray-800/50 rounded-3xl p-8 sm:p-12 mb-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Why Teachers Love It</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              'Reduces marking time by up to 70%, giving you hours back every week',
              'Maintains consistent, structured feedback across all student work',
              'Works with handwritten essays using optical character recognition',
              'Adapts to any subject area, from English to History to Science',
              'Keeps you in control with the ability to edit and personalize every comment',
              'Secure and private - your data is protected with enterprise-grade security'
            ].map((feature, index) => (
              <div key={index} className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="ml-4 text-lg text-gray-700 dark:text-gray-300">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Founder Story */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="md:flex">
            <div className="p-8 md:p-12">
              <div className="uppercase tracking-wide text-sm text-blue-600 dark:text-blue-400 font-semibold mb-2">Built For Teachers</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">The Story Behind Simple Rubriq</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Simple Rubriq was created by <strong>Wilson Roserie</strong>, an IT engineer who heard 
                one too many teacher friends talk about spending their entire weekends marking essays. 
                After listening to their struggles with marking fatigue, inconsistent feedback, and the 
                impossible choice between speed and quality, Wilson built Simple Rubriq to give educators 
                the support they desperately needed.
              </p>
              <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-r-lg">
                "My teacher friends were burning out from marking, and I knew technology could help. 
                Simple Rubriq is about giving teachers their time back so they can focus on what they 
                do best: inspiring students and building meaningful connections in the classroom."
              </blockquote>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-20 text-center border-t border-gray-200 dark:border-gray-700 pt-12">
          <div className="flex justify-center space-x-8 mb-8">
            <a href="https://simple-rubriq-demo.vercel.app" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Live Demo
            </a>
            <a href="https://github.com/WPR94/MarkMate-Demo" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              GitHub
            </a>
            <a href="mailto:simplrubriq@gmail.com" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Contact Support
            </a>
          </div>
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Simple Rubriq. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}