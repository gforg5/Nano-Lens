import React, { useEffect, useState } from 'react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Reveal timing
    const revealTimer = setTimeout(() => setIsVisible(true), 100);
    // Exit timing
    const exitTimer = setTimeout(() => setIsExiting(true), 2400);
    // Completion timing
    const completeTimer = setTimeout(() => onComplete(), 3000);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${isExiting ? 'opacity-0 scale-105' : 'opacity-100'}`}>
      {/* Background Atmosphere */}
      <div className={`absolute inset-0 bg-gradient-to-b from-indigo-950/10 via-black to-black transition-opacity duration-[1500ms] ${isVisible ? 'opacity-100' : 'opacity-0'}`}></div>
      
      {/* Central Identity */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Optical Element */}
        <div className={`relative mb-12 transition-all duration-[1200ms] cubic-bezier(0.2, 0, 0, 1) ${isVisible ? 'scale-100 opacity-100 rotate-0' : 'scale-50 opacity-0 rotate-[-45deg]'}`}>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border border-white/10 flex items-center justify-center relative overflow-hidden group">
            {/* Subtle Inner Glow */}
            <div className="absolute inset-0 bg-indigo-500/5 blur-xl"></div>
            
            {/* Aperture Blades Placeholder */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12 text-white/80">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <path d="M7 2L12.5 7" />
              <path d="M14 1.5L12.5 7" />
              <path d="M18 5L15 8.5" />
              <path d="M22 10L15.5 11" />
              <path d="M22 14L15.5 13" />
              <path d="M19 18.5L14 15.5" />
              <path d="M15 22L12.5 16.5" />
              <path d="M9 22L11 16.5" />
              <path d="M5 19L9.5 15" />
              <path d="M2 15L8.5 13" />
              <path d="M2 10L8.5 11" />
              <path d="M5 5L9 8" />
            </svg>
            
            {/* Scanner bar pulse */}
            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent translate-y-full animate-[shimmer_2s_infinite]"></div>
          </div>
          
          {/* Radial Pulse */}
          <div className="absolute -inset-10 border border-indigo-500/10 rounded-full animate-[ping_3s_infinite] opacity-50"></div>
        </div>

        {/* Text Branding */}
        <div className="overflow-hidden">
          <h1 className={`text-3xl sm:text-4xl font-light tracking-[0.6em] text-white transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
            NANO<span className="font-black text-indigo-500">LENS</span>
          </h1>
        </div>
        
        <div className={`mt-4 overflow-hidden transition-all duration-1000 delay-500 ${isVisible ? 'opacity-40' : 'opacity-0'}`}>
           <p className="text-[10px] font-medium tracking-[1em] uppercase text-zinc-400">Precision Vision</p>
        </div>
      </div>

      {/* Exit Loading State */}
      <div className={`absolute bottom-24 w-32 h-[1px] bg-white/5 transition-opacity duration-500 delay-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out]"></div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes loading {
          0% { width: 0; left: 0; }
          50% { width: 100%; left: 0; }
          100% { width: 0; left: 100%; }
        }
      `}</style>
    </div>
  );
};