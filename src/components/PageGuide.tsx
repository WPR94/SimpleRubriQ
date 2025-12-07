import { useState, ReactNode } from 'react';

export type GuideSection = {
  title: string;
  body: ReactNode;
};

interface PageGuideProps {
  title: string;
  summary?: string;
  sections: GuideSection[];
  ctaLabel?: string;
}

export function PageGuide({ title, summary, sections, ctaLabel = 'Open guide' }: PageGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <span>❓</span>
        <span>{ctaLabel}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden">
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                {summary && <p className="text-sm text-gray-600 mt-1">{summary}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none"
                aria-label="Close guide"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-auto max-h-[70vh]">
              {sections.map((section, idx) => (
                <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-base font-semibold text-gray-900 mb-2">{section.title}</h4>
                  <div className="text-sm text-gray-700 leading-relaxed space-y-1">{section.body}</div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
