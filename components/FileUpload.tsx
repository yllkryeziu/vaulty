
import React from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileChange: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileChange }) => {
  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (e.dataTransfer.files[0].type === 'application/pdf') {
        onFileChange(e.dataTransfer.files[0]);
      } else {
        alert("Please upload a PDF file.");
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="relative block w-full rounded-lg bg-neutral-900 border border-neutral-800 p-12 text-center hover:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-neutral-500 cursor-pointer transition-colors"
      >
        <UploadCloud className="mx-auto h-12 w-12 text-neutral-500" />
        <span className="mt-2 block text-sm font-medium text-neutral-400">
          Drag and drop a PDF file
        </span>
        <span className="mt-1 block text-xs text-neutral-500">
            or click to select a file
        </span>
        <input type="file" className="hidden" accept=".pdf" onChange={handleChange} />
      </label>
    </div>
  );
};