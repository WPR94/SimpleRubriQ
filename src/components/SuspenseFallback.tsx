import React from 'react';

export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] p-6 text-gray-600">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        <span className="text-sm font-medium">Loading...</span>
      </div>
    </div>
  );
}

export default SuspenseFallback;
