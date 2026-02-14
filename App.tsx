import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Sparkles, Send, X, Download, RotateCcw, Image as ImageIcon, Video, History, ChevronLeft, Trash2, Share2, FileText, User, Github, Linkedin, Code, ZoomIn, Play, Pause, Wand2, Box, Mic, MessageSquare, Scan, CheckCircle2, ShieldCheck, ExternalLink, RefreshCw } from 'lucide-react';
import { jsPDF } from "jspdf";
import { analyzeImage, editImage, analyzeVideo, generalChat } from './services/geminiService';
import { AppState, ImageFile, EditResult, CaptureMode, HistoryItem } from './types';
import { Button } from './components/Button';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SplashScreen } from './components/SplashScreen';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [currentFile, setCurrentFile] = useState<ImageFile | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [generalPrompt, setGeneralPrompt] = useState("");
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [activeAi, setActiveAi] = useState<'transform' | 'chat'>('chat');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nanoLensHistoryV5');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) { console.error("History load error", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nanoLensHistoryV5', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (showSplash || appState !== AppState.IDLE) return;
      try {
        setCameraError(false);
        const constraints = {
          video: { 
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false 
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;
        
        // @ts-ignore
        if (track.getCapabilities) {
           const capabilities = track.getCapabilities() as any;
           if (capabilities && capabilities.zoom) {
             setSupportsZoom(true);
             setMaxZoom(capabilities.zoom.max);
             setZoom(capabilities.zoom.min || 1);
           } else {
             setSupportsZoom(false);
           }
        }
      } catch (err) { 
        console.error("Camera access failed:", err);
        setCameraError(true); 
      }
    };
    
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [appState, facingMode, showSplash]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    if (videoTrackRef.current) {
      try {
        // @ts-ignore
        await videoTrackRef.current.applyConstraints({ advanced: [{ zoom: newZoom }] });
      } catch (err) {}
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    const base64String = canvas.toDataURL('image/jpeg', 0.9);
    const newFile: ImageFile = {
      id: Date.now().toString(),
      preview: base64String,
      raw: base64String.split(',')[1],
      mimeType: 'image/jpeg',
      timestamp: Date.now(),
      type: 'image'
    };
    setCurrentFile(newFile);
    await performAnalysis(newFile);
  };

  const performAnalysis = async (file: ImageFile) => {
    setAppState(AppState.ANALYZING);
    try {
      const result = await analyzeImage(file.raw, file.mimeType);
      const fileWithAnalysis = { ...file, analysis: result };
      setCurrentFile(fileWithAnalysis);
      addToHistory(fileWithAnalysis);
      setAppState(AppState.VIEWING);
    } catch (err) { setAppState(AppState.VIEWING); }
  };

  const handleEditSubmit = async (promptOverride?: string) => {
    const prompt = promptOverride || editPrompt;
    if (!currentFile || !prompt.trim() || currentFile.type === 'video') return;
    setAppState(AppState.EDITING);
    try {
      const sourceImageRaw = editedImage ? editedImage.split(',')[1] : currentFile.raw;
      const result = await editImage(sourceImageRaw, "image/png", prompt);
      if (result.imageData) {
        setEditedImage(`data:image/png;base64,${result.imageData}`);
        setEditPrompt("");
      }
    } catch (err) { console.error("Edit failed", err); }
    finally { setAppState(AppState.VIEWING); }
  };

  const handleGeneralChat = async () => {
    if (!currentFile || !generalPrompt.trim()) return;
    const prompt = generalPrompt;
    setGeneralPrompt("");
    setAppState(AppState.ANALYZING);
    const responseText = await generalChat(currentFile.raw, currentFile.mimeType, prompt);
    const updatedFile = {
      ...currentFile,
      generalChat: [...(currentFile.generalChat || []), { role: 'user' as const, text: prompt }, { role: 'model' as const, text: responseText }]
    };
    setCurrentFile(updatedFile);
    setAppState(AppState.VIEWING);
  };

  const toggleVoice = (target: 'edit' | 'general') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (target === 'edit') setEditPrompt(transcript);
      else setGeneralPrompt(transcript);
    };
    recognition.onend = () => setIsListening(false);
  };

  const handleShare = async () => {
    if (!currentFile) return;
    try {
      const response = await fetch(editedImage || currentFile.preview);
      const blob = await response.blob();
      const file = new File([blob], `nano-lens-${Date.now()}.jpg`, { type: 'image/jpeg' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Nano Lens', text: 'AI Vision Report' });
      } else {
        const link = document.createElement('a');
        link.href = editedImage || currentFile.preview;
        link.download = `nano-lens-${Date.now()}.jpg`;
        link.click();
      }
    } catch (err) { console.error("Share error", err); }
  };

  const downloadProfessionalPdf = () => {
    if (!currentFile) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("Mohsin Nano-Lens Guide", 20, 26);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`TIME & DATE: ${new Date(currentFile.timestamp).toLocaleString().toUpperCase()}`, 20, 34);
    if (currentFile.type === 'image') {
       doc.addImage(editedImage || currentFile.preview, 'JPEG', 20, 50, pageWidth - 40, 100);
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("ANALYSIS INSIGHTS", 20, 165);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    currentFile.analysis?.points?.forEach((p, i) => {
      doc.text(`${i + 1}. ${p}`, 20, 175 + (i * 10), { maxWidth: pageWidth - 40 });
    });
    doc.save(`Mohsin_NanoLens_Report.pdf`);
  };

  const addToHistory = (item: HistoryItem) => setHistory(prev => [item, ...prev].slice(0, 50));
  
  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    setHistory([]);
  };

  const resetApp = () => {
    setCurrentFile(null);
    setEditedImage(null);
    setAppState(AppState.IDLE);
  };

  const renderBoundingBoxes = () => {
    if (!currentFile?.analysis?.detectedObjects || currentFile.type !== 'image') return null;
    return currentFile.analysis.detectedObjects.map((obj, index) => {
      const [ymin, xmin, ymax, xmax] = obj.box_2d;
      return (
        <div key={index} className="absolute border-2 border-white/80 bg-white/5 rounded-lg pointer-events-none z-10 animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          style={{ top: (ymin / 10) + '%', left: (xmin / 10) + '%', width: ((xmax - xmin) / 10) + '%', height: ((ymax - ymin) / 10) + '%' }}>
          <div className="absolute -top-10 left-0 bg-black/90 backdrop-blur-xl text-white text-[13px] font-black px-3 py-1.5 rounded-lg shadow-[0_8px_25px_rgba(0,0,0,0.8)] uppercase border border-white/30 whitespace-nowrap">
            {obj.label}
          </div>
        </div>
      );
    });
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans overflow-hidden relative selection:bg-indigo-500 animate-in fade-in duration-1000">
      {appState === AppState.ANALYZING && <LoadingOverlay message="Analyzing..." />}
      {appState === AppState.EDITING && <LoadingOverlay message="Synchronizing Synapses..." />}

      {/* --- ELITE PRO CAMERA HUD --- */}
      {(appState === AppState.IDLE || appState === AppState.RECORDING) && (
        <div className="absolute inset-0 z-0 bg-black flex flex-col animate-in fade-in duration-1000">
          {!cameraError ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover grayscale-[0.05] transition-transform duration-500 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
              <ShieldCheck className="w-16 h-16 text-zinc-900 mb-8" />
              <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Retry Access</button>
            </div>
          )}

          {/* High-Impact HUD Frame */}
          {!cameraError && appState === AppState.IDLE && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className="w-56 h-56 sm:w-64 sm:h-64 border border-white/10 rounded-[3rem] relative mb-24 animate-[pulseScale_4s_infinite_ease-in-out] flex items-center justify-center">
                <i className="fi fi-rr-hand-holding-heart text-5xl text-white/10"></i>
                <div className="absolute top-0 left-0 w-10 h-10 border-t-[4px] border-l-[4px] border-white rounded-tl-[1.5rem] shadow-[0_0_20px_rgba(255,255,255,0.4)]"></div>
                <div className="absolute top-0 right-0 w-10 h-10 border-t-[4px] border-r-[4px] border-white rounded-tr-[1.5rem] shadow-[0_0_20px_rgba(255,255,255,0.4)]"></div>
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[4px] border-l-[4px] border-white rounded-bl-[1.5rem] shadow-[0_0_20px_rgba(255,255,255,0.4)]"></div>
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[4px] border-r-[4px] border-white rounded-br-[1.5rem] shadow-[0_0_20px_rgba(255,255,255,0.4)]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[scan_3.5s_ease-in-out_infinite]"></div>
              </div>
            </div>
          )}

          {/* Top Control Cluster */}
          <div className="absolute top-0 left-0 right-0 p-5 sm:p-8 z-20 flex justify-between items-center max-w-lg mx-auto w-full">
            <button onClick={() => setShowHistory(true)} className="p-4 sm:p-5 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90 shadow-2xl"><History className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            
            <div className="px-5 py-2.5 bg-black/40 backdrop-blur-3xl rounded-full border border-white/10 cursor-pointer active:scale-95 transition-all flex items-center gap-3 group" onClick={toggleCamera}>
               <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.4em] group-hover:text-white transition-colors">Cam: <span className="text-white/80">{facingMode === 'environment' ? 'Rear' : 'Front'}</span></span>
               <RefreshCw className="w-3 h-3 text-indigo-500/60 group-hover:rotate-180 transition-transform duration-700" />
            </div>

            <button onClick={() => setShowDeveloper(true)} className="p-4 sm:p-5 bg-black/40 backdrop-blur-3xl rounded-3xl border border-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90 shadow-2xl"><User className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          </div>

          {/* Precise Controls at Bottom */}
          <div className="absolute bottom-0 left-0 right-0 pb-10 sm:pb-16 pt-32 flex flex-col items-center z-20 bg-gradient-to-t from-black via-black/40 to-transparent">
             <div className="mb-6 sm:mb-8 opacity-40 animate-[pulseFade_3s_infinite]">
                <span className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-[0.5em] drop-shadow-lg">Capture Visual</span>
             </div>

             {supportsZoom && appState === AppState.IDLE && (
               <div className="flex flex-col items-center gap-4 bg-black/40 backdrop-blur-3xl px-10 py-5 sm:px-12 sm:py-6 rounded-[2.5rem] border border-white/5 shadow-2xl mb-8 sm:mb-10 transition-all group">
                 <div className="text-[8px] font-black text-white/40 uppercase tracking-[0.5em] group-hover:text-white transition-colors">Digital Zoom: <span className="text-white/80">{zoom.toFixed(1)}x</span></div>
                 <input type="range" min="1" max={Math.min(maxZoom, 10)} step="0.1" value={zoom} onChange={handleZoomChange} className="w-44 sm:w-56 h-0.5 bg-white/10 rounded-full appearance-none accent-white cursor-pointer" />
               </div>
             )}
             
             <div className="flex items-center gap-6 sm:gap-12">
               <button onClick={() => fileInputRef.current?.click()} className="p-5 sm:p-7 bg-white/5 backdrop-blur-3xl rounded-[2rem] border border-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90"><ImageIcon className="w-6 h-6 sm:w-7 sm:h-7" /></button>
               
               <button onClick={capturePhoto} className="relative h-24 w-24 sm:h-28 sm:w-28 group transition-transform active:scale-95">
                 <div className="absolute inset-0 rounded-full border-[2px] border-white/10 scale-125 group-hover:scale-150 transition-all duration-1000 opacity-0 group-hover:opacity-100"></div>
                 <div className="absolute inset-0 rounded-full border-[3px] border-white/20 scale-110 group-hover:scale-125 transition-all duration-700 shadow-[0_0_30px_rgba(255,255,255,0.2)]"></div>
                 <div className="absolute inset-0 rounded-full border-[3px] border-white transition-all duration-300"></div>
                 <div className="m-2.5 h-[calc(100%-1.25rem)] w-[calc(100%-1.25rem)] rounded-full bg-white group-hover:scale-90 shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-all duration-500 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent animate-[shine_4s_infinite]"></div>
                    <i className="fi fi-rr-hand-holding-heart text-2xl text-black/20"></i>
                 </div>
               </button>

               <button onClick={resetApp} className="p-5 sm:p-7 bg-white/5 backdrop-blur-3xl rounded-[2rem] border border-white/5 text-white/20 hover:text-white hover:bg-white/10 transition-all active:scale-90"><RotateCcw className="w-6 h-6 sm:w-7 sm:h-7" /></button>
             </div>
          </div>
        </div>
      )}

      {/* --- ELITE DASHBOARD --- */}
      {(appState === AppState.VIEWING || appState === AppState.EDITING || appState === AppState.ANALYZING) && currentFile && (
        <div className="flex flex-col h-screen w-full bg-black relative z-40 animate-in slide-in-from-bottom duration-700">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5 bg-black/80 backdrop-blur-3xl sticky top-0 z-50">
            <button onClick={resetApp} className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[8px] sm:text-[9px] uppercase tracking-widest transition-all shadow-xl">
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" /> New Scan
            </button>
            <div className="flex gap-2 sm:gap-3">
               <button onClick={handleShare} className="p-3 sm:p-4 bg-zinc-900 rounded-2xl border border-white/5 text-zinc-400 hover:text-white shadow-xl transition-all"><Share2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>
               <button onClick={downloadProfessionalPdf} className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[8px] sm:text-[9px] uppercase tracking-widest shadow-2xl border border-indigo-400 transition-all">
                 <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Export PDF
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-64 sm:pb-80 scrollbar-none">
            <div className="w-full bg-black relative flex justify-center items-center py-6 sm:py-10 border-b border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full scale-150 animate-pulse"></div>
              <div className="relative inline-block max-w-[94%] sm:max-w-[92%] z-10">
                <img src={editedImage || currentFile.preview} className="max-h-[46vh] sm:max-h-[52vh] rounded-[2rem] sm:rounded-[2.5rem] object-contain block shadow-[0_0_80px_rgba(0,0,0,1)] border border-white/10" />
                <div className="absolute inset-0">{renderBoundingBoxes()}</div>
              </div>
            </div>

            <div className="p-6 sm:p-10 max-w-2xl mx-auto space-y-10 sm:space-y-16">
              <div className="flex items-center gap-4 sm:gap-6">
                 <div className="h-10 sm:h-14 w-1.5 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                 <div>
                   <h3 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter leading-none mb-1 flex items-center gap-4">
                     Elite Analysis
                     <i className="fi fi-rr-hand-holding-heart text-indigo-500 text-2xl sm:text-3xl"></i>
                   </h3>
                   <p className="text-[8px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-widest">Neural Logic Architecture v5.0</p>
                 </div>
              </div>
              
              <div className="grid gap-4 sm:gap-6">
                 {currentFile.analysis?.points?.map((p, i) => (
                   <div key={i} className="flex gap-5 sm:gap-8 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] bg-zinc-900/30 border border-white/5 hover:bg-zinc-900/50 hover:border-indigo-500/30 transition-all duration-700 group shadow-2xl">
                     <span className="h-10 w-10 sm:h-14 sm:w-14 shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl bg-zinc-950 text-indigo-400 border border-white/5 font-black text-lg sm:text-xl shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all">{i+1}</span>
                     <p className="text-zinc-200 font-bold leading-relaxed pt-2 sm:pt-3 text-base sm:text-lg italic tracking-tight">{p}</p>
                   </div>
                 ))}
              </div>

              {currentFile.analysis?.groundingLinks && currentFile.analysis.groundingLinks.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h4 className="text-[8px] sm:text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" /> Grounded Web Intelligence
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {currentFile.analysis.groundingLinks.map((link, idx) => (
                      <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-xl text-[10px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-indigo-400 transition-all flex items-center gap-2">
                        {link.title} <ChevronLeft className="w-3 h-3 rotate-180" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {currentFile.generalChat && currentFile.generalChat.length > 0 && (
                <div className="space-y-6 sm:space-y-8 pt-10 sm:pt-12 border-t border-white/10">
                  <h4 className="text-[8px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] flex items-center gap-3"> Intelligence Synapse Log</h4>
                  <div className="space-y-4 sm:space-y-6">
                    {currentFile.generalChat.map((msg, i) => (
                      <div key={i} className={`p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border ${msg.role === 'user' ? 'bg-indigo-600/5 border-indigo-500/20 ml-6 sm:ml-12' : 'bg-zinc-900/50 border-white/5 mr-6 sm:mr-12 shadow-inner relative'}`}>
                        {msg.role === 'model' && <div className="absolute -left-2 sm:-left-3 top-1/2 -translate-y-1/2 w-1 h-8 sm:h-12 bg-indigo-500 rounded-full blur-[2px]"></div>}
                        <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest block mb-2 sm:mb-4 ${msg.role === 'user' ? 'text-indigo-400' : 'text-zinc-500'}`}>{msg.role.toUpperCase()}</span>
                        <p className="text-zinc-200 font-medium leading-relaxed sm:leading-loose text-sm sm:text-base">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-8 bg-black/95 backdrop-blur-3xl border-t border-white/5 z-[60] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
             <div className="max-w-xl mx-auto space-y-4 sm:space-y-6">
               <div className="flex bg-zinc-900/60 p-1 rounded-[1.25rem] sm:rounded-[1.5rem] w-fit mx-auto border border-white/5 shadow-inner">
                 <button onClick={() => setActiveAi('chat')} className={`px-6 sm:px-10 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all ${activeAi === 'chat' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:text-white'}`}>NEURAL CHAT</button>
                 <button onClick={() => setActiveAi('transform')} className={`px-6 sm:px-10 py-2 sm:py-3 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all ${activeAi === 'transform' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:text-white'}`}>AI RECONSTRUCT</button>
               </div>

               <div className="relative flex items-center bg-zinc-900/80 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 px-2 sm:px-4 shadow-2xl focus-within:border-indigo-500 transition-all">
                 <input type="text" value={activeAi === 'chat' ? generalPrompt : editPrompt} 
                        onChange={(e) => activeAi === 'chat' ? setGeneralPrompt(e.target.value) : setEditPrompt(e.target.value)} 
                        placeholder={activeAi === 'chat' ? "Inquire visual data..." : "Neural transformation parameters..."} 
                        className="w-full bg-transparent border-none text-white py-4 sm:py-6 px-3 sm:px-4 focus:ring-0 font-bold text-base sm:text-lg placeholder:text-zinc-700" />
                 <button onClick={() => toggleVoice(activeAi === 'chat' ? 'general' : 'edit')} className="p-3 sm:p-4 text-zinc-600 hover:text-white transition-all"><Mic className={`w-5 h-5 sm:w-6 sm:h-6 ${isListening ? 'text-red-500 animate-pulse shadow-red-500 shadow-xl' : ''}`} /></button>
                 <button onClick={() => activeAi === 'chat' ? handleGeneralChat() : handleEditSubmit()} className="p-4 sm:p-5 bg-white hover:bg-zinc-200 rounded-2xl sm:rounded-3xl ml-2 sm:ml-3 active:scale-95 transition-all shadow-2xl"><Send className="w-5 h-5 sm:w-6 sm:h-6 text-black" /></button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* --- ELITE CONCISE DEVELOPER PROFILE --- */}
      {showDeveloper && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 sm:p-8 animate-in zoom-in-95 duration-500">
           <div className="absolute inset-0 bg-black/98 backdrop-blur-[40px]" onClick={() => setShowDeveloper(false)} />
           <div className="relative bg-zinc-900/40 border border-white/10 rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 max-w-sm w-full text-center shadow-[0_0_100px_rgba(0,0,0,1)] group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"></div>
              <button onClick={() => setShowDeveloper(false)} className="absolute top-6 sm:top-8 right-6 sm:right-8 text-zinc-600 hover:text-white transition-all active:scale-90"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
              
              <div className="relative mb-6 sm:mb-8 inline-block">
                <div className="absolute -inset-6 sm:-inset-8 bg-indigo-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
                <img src="https://raw.githubusercontent.com/gforg5/nanolens/main/myimg.jpg" 
                     onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1556157382-97eda2d62296?fit=crop&w=300&h=300&q=80" }} 
                     className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto border-[4px] sm:border-[5px] border-zinc-900 shadow-2xl object-cover hover:scale-105 transition-transform duration-700" />
              </div>
              
              <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter uppercase mb-1 drop-shadow-lg">Sayed Mohsin Ali</h2>
              <p className="text-indigo-400 font-black tracking-[0.4em] text-[8px] sm:text-[9px] uppercase mb-6 sm:mb-8 flex items-center justify-center gap-3">
                <i className="fi fi-rr-hand-holding-heart text-xs"></i> Systems Developer
              </p>
              
              <div className="bg-black/50 p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] mb-8 sm:mb-10 border border-white/5 shadow-inner">
                <p className="text-zinc-400 text-[10px] sm:text-[12px] leading-relaxed font-medium italic">
                  "Engineering elite neural vision ecosystems that push the boundaries of reality."
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <a href="https://github.com/gforg5" target="_blank" rel="noreferrer" 
                   className="group/btn flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-zinc-800/80 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase text-white hover:bg-white hover:text-black transition-all shadow-xl border border-white/5 active:scale-95">
                   <Github className="w-3 h-3 sm:w-4 h-4 group-hover/btn:scale-110 transition-transform" /> 
                   <span>Github</span>
                </a>
                <a href="https://www.linkedin.com/in/sayedmohsinali/" target="_blank" rel="noreferrer" 
                   className="group/btn flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-4 bg-zinc-800/80 rounded-xl sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase text-white hover:bg-[#0077b5] border border-white/5 transition-all shadow-xl active:scale-95">
                   <Linkedin className="w-3 h-3 sm:w-4 h-4 group-hover/btn:scale-110 transition-transform" /> 
                   <span>Linkedin</span>
                </a>
              </div>
           </div>
        </div>
      )}

      {/* --- ARCHIVES DRAWER --- */}
      {showHistory && (
        <div className="absolute inset-0 z-[100] flex animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-black/98 backdrop-blur-3xl" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-xs h-full bg-black border-r border-white/5 flex flex-col p-8 sm:p-12 animate-in slide-in-from-left duration-700">
             <div className="flex justify-between items-center mb-10 sm:mb-16">
               <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">Archives</h2>
               <div className="flex gap-3">
                 {history.length > 0 && (
                   <button onClick={clearAllHistory} className="p-3 bg-zinc-900 rounded-xl text-red-500 hover:text-red-400 transition-all active:scale-90"><Trash2 className="w-5 h-5" /></button>
                 )}
                 <button onClick={() => setShowHistory(false)} className="p-3 bg-zinc-900 rounded-xl text-zinc-500 hover:text-white transition-all active:scale-90"><X className="w-5 h-5" /></button>
               </div>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 scrollbar-none pr-2">
               {history.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-10 gap-6 sm:gap-8"><History className="w-12 h-12 sm:w-16 sm:h-16" /><p className="font-black uppercase tracking-[0.4em] text-[8px] sm:text-[9px]">STORAGE_EMPTY</p></div>
               ) : (
                 history.map(item => (
                   <div key={item.id} onClick={() => { setCurrentFile(item); setAppState(AppState.VIEWING); setShowHistory(false); }} className="p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] bg-zinc-900/30 border border-white/5 flex gap-4 sm:gap-5 cursor-pointer hover:bg-zinc-900 hover:border-indigo-500/40 transition-all group shadow-inner relative">
                      <button 
                        onClick={(e) => deleteHistoryItem(e, item.id)} 
                        className="absolute -top-2 -right-2 p-2 bg-red-600 rounded-full text-white transition-all shadow-lg scale-100 z-10 active:bg-red-500"
                        aria-label="Delete entry"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-lg sm:rounded-xl overflow-hidden shrink-0 border border-white/5">{item.type === 'image' && <img src={item.preview} className="w-full h-full object-cover grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" />}</div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[7px] sm:text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">{new Date(item.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[10px] sm:text-[12px] font-bold truncate text-zinc-500 group-hover:text-white transition-colors">{item.analysis?.points?.[0] || "Neural Log"}</p>
                      </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          blobToBase64(file).then(base64 => {
             const newFile: ImageFile = { id: Date.now().toString(), preview: base64, raw: base64.split(',')[1], mimeType: file.type, timestamp: Date.now(), type: file.type.startsWith('video') ? 'video' : 'image' };
             setCurrentFile(newFile);
             performAnalysis(newFile);
          });
        }
      }} />

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(224px); opacity: 0; }
        }
        @keyframes shine {
          0% { left: -100%; top: -100%; }
          50%, 100% { left: 100%; top: 100%; }
        }
        @keyframes pulseScale {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes pulseFade {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50% { opacity: 0.6; transform: translateY(-3px); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}