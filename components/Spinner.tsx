
import React from 'react';

interface SpinnerProps {
    message?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="w-8 h-8 border-2 border-t-white border-r-white border-b-white border-l-transparent rounded-full animate-spin"></div>
      {message && <p className="mt-4 text-neutral-400 text-sm">{message}</p>}
    </div>
  );
};