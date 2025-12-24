
import React from 'react';
import { Sparkles } from 'lucide-react';

interface LoadingOverlayProps {
  message: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-indigo-500 opacity-20 duration-1000"></div>
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 ring-1 ring-indigo-500/50">
          <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
        </div>
      </div>
      <h3 className="mt-4 text-xl font-medium text-white">{message}</h3>
      <p className="mt-2 text-sm text-zinc-400">Analyzing</p>
    </div>
  );
};
