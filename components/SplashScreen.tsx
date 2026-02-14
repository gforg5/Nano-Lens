import React, { useEffect, useState } from 'react';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer1 = setTimeout(() => setStage(1), 500);
    const timer2 = setTimeout(() => setStage(2), 2500);
    const timer3 = setTimeout(() => onComplete(), 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center transition-opacity duration-1000 ${stage === 2 ? 'opacity-0' : 'opacity-100'}`}>
      <div className="relative group">
        {/* Outer Glow Ring */}
        <div className={`absolute -inset-24 bg-indigo-500/10 rounded-full blur-[100px] transition-all duration-1000 ${stage >= 1 ? 'scale-150 opacity-100' : 'scale-50 opacity-0'}`}></div>
        
        {/* Animated Lens Rings */}
        <div className="relative flex items-center justify-center">
          <div className={`w-32 h-32 border-2 border-indigo-500/20 rounded-full transition-all duration-1000 ${stage >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}></div>
          <div className={`absolute w-24 h-24 border-2 border-white/10 rounded-full transition-all duration-[1500ms] ${stage >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}></div>
          <div className={`absolute w-12 h-12 bg-indigo-500 rounded-full shadow-[0_0_40px_rgba(99,102,241,0.8)] transition-all duration-700 delay-300 ${stage >= 1 ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
             <div className="absolute top-2 left-3 w-2 h-2 bg-white/40 rounded-full"></div>
          </div>
          
          {/* Scanning Line Effect */}
          <div className={`absolute inset-0 w-48 h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent -translate-x-full transition-transform duration-[2000ms] ease-in-out ${stage === 1 ? 'translate-x-full' : ''}`}></div>
        </div>
      </div>

      <div className="mt-16 text-center">
        <h1 className={`text-4xl sm:text-5xl font-black italic tracking-[0.2em] transition-all duration-1000 delay-500 ${stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          NANO <span className="text-indigo-500">LENS</span>
        </h1>
        <p className={`mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em] transition-all duration-1000 delay-700 ${stage >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          Hyper-Visual Intelligence
        </p>
      </div>

      {/* Modern Loader Bar */}
      <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-zinc-900 rounded-full overflow-hidden transition-all duration-500 delay-1000 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`h-full bg-indigo-500 transition-all duration-[2000ms] ease-out ${stage >= 1 ? 'w-full' : 'w-0'}`}></div>
      </div>

      <div className={`absolute bottom-8 text-[8px] font-black text-zinc-800 uppercase tracking-widest transition-opacity duration-500 ${stage >= 1 ? 'opacity-100' : 'opacity-0'}`}>
        Version 5.0.4 PRO
      </div>
    </div>
  );
};