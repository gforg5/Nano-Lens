import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Sparkles, Send, X, Download, RotateCcw, Image as ImageIcon, Video, History, ChevronLeft, Trash2, Share2, FileText, User, Github, Linkedin, Code, ZoomIn, Play, Pause, Wand2, Box, Mic, MessageSquare, Scan, CheckCircle2, ShieldCheck, ExternalLink, RefreshCw, Aperture, Target } from 'lucide-react';
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
            width: { ideal: 1920 },
            height: { ideal: 1080 }
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
    } catch (err) { 
      setAppState(AppState.VIEWING); 
    }
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
    doc.setFillColor(0, 0, 0); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("NANOLENS REPORT", 20, 26);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`ID: ${currentFile.id} | DATE: ${new Date(currentFile.timestamp).toLocaleString()}`, 20, 34);
    if (currentFile.type === 'image') {
       doc.addImage(editedImage || currentFile.preview, 'JPEG', 20, 50, pageWidth - 40, 100);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ANALYSIS LOG", 20, 165);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    currentFile.analysis?.points?.forEach((p, i) => {
      doc.text(`${i + 1}. ${p}`, 20, 175 + (i * 10), { maxWidth: pageWidth - 40 });
    });
    doc.save(`NanoLens_Export_${currentFile.id}.pdf`);
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
        <div key={index} className="absolute border-[1px] border-white/40 bg-white/5 rounded-sm pointer-events-none z-10"
          style={{ top: (ymin / 10) + '%', left: (xmin / 10) + '%', width: ((xmax - xmin) / 10) + '%', height: ((ymax - ymin) / 10) + '%' }}>
          <div className="absolute -top-6 left-0 bg-black/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/10 whitespace-nowrap uppercase tracking-widest">
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
    <div className="min-h-screen bg-black text-zinc-100 font-sans overflow-hidden relative selection:bg-indigo-500">
      {appState === AppState.ANALYZING && <LoadingOverlay message="Analyzing..." />}
      {appState === AppState.EDITING && <LoadingOverlay message="Processing..." />}

      {/* --- HUD CAMERA INTERFACE --- */}
      {(appState === AppState.IDLE || appState === AppState.RECORDING) && (
        <div className="absolute inset-0 z-0 bg-black flex flex-col animate-in fade-in duration-1000">
          {!cameraError ? (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`absolute inset-0 w-full h-full object-cover grayscale-[0.1] transition-transform duration-700 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black">
              <ShieldCheck className="w-12 h-12 text-zinc-800 mb-6" />
              <button onClick={() => window.location.reload()} className="px-8 py-3 bg-zinc-900 text-white rounded-full font-bold text-[10px] uppercase tracking-widest border border-white/10">Reconnect Device</button>
            </div>
          )}

          {/* Minimalist HUD */}
          {!cameraError && appState === AppState.IDLE && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
               <div className="w-64 h-64 border border-white/5 rounded-full relative animate-[pulseSlow_4s_infinite] flex items-center justify-center">
                  <Target className="w-8 h-8 text-white/20" />
                  <div className="absolute inset-0 border-[0.5px] border-indigo-500/20 rounded-full scale-110"></div>
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/40"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-white/40"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-white/40"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/40"></div>
               </div>
            </div>
          )}

          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center max-w-lg mx-auto w-full">
            <button onClick={() => setShowHistory(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/5 text-white/50 hover:text-white transition-all"><History className="w-5 h-5" /></button>
            
            <div className="px-4 py-2 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-3" onClick={toggleCamera}>
               <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">{facingMode === 'environment' ? 'Rear Lens' : 'Face Lens'}</span>
               <RefreshCw className="w-3 h-3 text-indigo-400" />
            </div>

            <button onClick={() => setShowDeveloper(true)} className="p-4 bg-black/40 backdrop-blur-xl rounded-full border border-white/5 text-white/50 hover:text-white transition-all"><User className="w-5 h-5" /></button>
          </div>

          {/* Bottom Bar Controls */}
          <div className="absolute bottom-0 left-0 right-0 pb-12 pt-24 flex flex-col items-center z-20 bg-gradient-to-t from-black via-black/20 to-transparent">
             {supportsZoom && appState === AppState.IDLE && (
               <div className="mb-10 w-48 flex items-center gap-4 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5">
                 <Target className="w-3 h-3 text-white/40" />
                 <input type="range" min="1" max={Math.min(maxZoom, 10)} step="0.1" value={zoom} onChange={handleZoomChange} className="w-full h-[1px] bg-white/10 rounded-full appearance-none accent-white cursor-pointer" />
               </div>
             )}
             
             <div className="flex items-center gap-8 sm:gap-12">
               <button onClick={() => fileInputRef.current?.click()} className="p-5 bg-white/5 backdrop-blur-xl rounded-full border border-white/5 text-white/40 hover:text-white transition-all"><Upload className="w-6 h-6" /></button>
               
               <button onClick={capturePhoto} className="relative h-20 w-20 group active:scale-95 transition-all">
                 <div className="absolute inset-0 rounded-full border border-white/20 group-hover:scale-110 transition-transform"></div>
                 <div className="absolute inset-[4px] rounded-full border-2 border-white group-hover:border-indigo-400 transition-colors"></div>
                 <div className="absolute inset-[10px] rounded-full bg-white group-hover:bg-indigo-400 transition-colors shadow-2xl flex items-center justify-center">
                    <Aperture className="w-6 h-6 text-black/20" />
                 </div>
               </button>

               <button onClick={resetApp} className="p-5 bg-white/5 backdrop-blur-xl rounded-full border border-white/5 text-white/40 hover:text-white transition-all"><RotateCcw className="w-6 h-6" /></button>
             </div>
             
             <div className="mt-8">
                <span className="text-[8px] font-bold text-white/20 uppercase tracking-[0.6em]">System Standby</span>
             </div>
          </div>
        </div>
      )}

      {/* --- RESULTS DASHBOARD --- */}
      {(appState === AppState.VIEWING || appState === AppState.EDITING || appState === AppState.ANALYZING) && currentFile && (
        <div className="flex flex-col h-screen w-full bg-black relative z-40 animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5 bg-black sticky top-0 z-50">
            <button onClick={resetApp} className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 text-white font-bold text-[9px] uppercase tracking-widest border border-white/10">
              <X className="w-3 h-3" /> Close
            </button>
            <div className="flex gap-2">
               <button onClick={handleShare} className="p-3 bg-zinc-900 rounded-full border border-white/5 text-zinc-400 hover:text-white transition-all"><Share2 className="w-4 h-4" /></button>
               <button onClick={downloadProfessionalPdf} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-[9px] uppercase tracking-widest shadow-xl transition-all">
                 <Download className="w-4 h-4" /> Export
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pb-64 scrollbar-none">
            <div className="w-full bg-black relative flex justify-center items-center py-6 sm:py-12 border-b border-white/5">
              <div className="relative inline-block max-w-[90%] z-10">
                <img src={editedImage || currentFile.preview} className="max-h-[50vh] rounded-2xl object-contain block border border-white/10 shadow-2xl" />
                <div className="absolute inset-0">{renderBoundingBoxes()}</div>
              </div>
            </div>

            <div className="p-6 sm:p-12 max-w-2xl mx-auto space-y-12">
              <div className="space-y-2">
                <h3 className="text-2xl font-light tracking-tight text-white flex items-center gap-3">
                   Visual Analysis
                   <div className="h-[1px] flex-1 bg-white/10"></div>
                </h3>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">NANO-AI PROCESSING v5.0.4</p>
              </div>
              
              <div className="space-y-4">
                 {currentFile.analysis?.points?.map((p, i) => (
                   <div key={i} className="flex gap-6 p-6 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 group">
                     <span className="text-zinc-600 font-bold text-xs uppercase tracking-tighter pt-1">0{i+1}</span>
                     <p className="text-zinc-300 font-medium leading-relaxed tracking-tight text-sm sm:text-base">{p}</p>
                   </div>
                 ))}
              </div>

              {currentFile.analysis?.groundingLinks && currentFile.analysis.groundingLinks.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-white/5">
                  <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">Reference Sources</h4>
                  <div className="flex flex-wrap gap-2">
                    {currentFile.analysis.groundingLinks.map((link, idx) => (
                      <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-zinc-900 border border-white/5 rounded-lg text-[10px] font-bold text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                        {link.title} <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {currentFile.generalChat && currentFile.generalChat.length > 0 && (
                <div className="space-y-6 pt-12 border-t border-white/5">
                  <h4 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Interaction Log</h4>
                  <div className="space-y-4">
                    {currentFile.generalChat.map((msg, i) => (
                      <div key={i} className={`p-6 rounded-2xl border ${msg.role === 'user' ? 'bg-indigo-600/5 border-indigo-500/20 ml-8' : 'bg-zinc-900/40 border-white/5 mr-8'}`}>
                        <span className={`text-[8px] font-bold uppercase tracking-widest block mb-2 ${msg.role === 'user' ? 'text-indigo-400' : 'text-zinc-500'}`}>{msg.role}</span>
                        <p className="text-zinc-300 text-sm leading-relaxed">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-2xl border-t border-white/5 z-[60]">
             <div className="max-w-xl mx-auto space-y-4">
               <div className="flex bg-zinc-900/60 p-1 rounded-full w-fit mx-auto border border-white/5">
                 <button onClick={() => setActiveAi('chat')} className={`px-8 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${activeAi === 'chat' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Intelligence</button>
                 <button onClick={() => setActiveAi('transform')} className={`px-8 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${activeAi === 'transform' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>Reconstruct</button>
               </div>

               <div className="relative flex items-center bg-zinc-900 rounded-2xl border border-white/10 px-4 shadow-xl focus-within:border-indigo-500 transition-all">
                 <input type="text" value={activeAi === 'chat' ? generalPrompt : editPrompt} 
                        onChange={(e) => activeAi === 'chat' ? setGeneralPrompt(e.target.value) : setEditPrompt(e.target.value)} 
                        placeholder={activeAi === 'chat' ? "Ask about the scene..." : "Describe reconstruction..."} 
                        className="w-full bg-transparent border-none text-white py-4 px-2 focus:ring-0 text-sm placeholder:text-zinc-700" />
                 <button onClick={() => toggleVoice(activeAi === 'chat' ? 'general' : 'edit')} className="p-3 text-zinc-600 hover:text-white"><Mic className={`w-5 h-5 ${isListening ? 'text-indigo-500 animate-pulse' : ''}`} /></button>
                 <button onClick={() => activeAi === 'chat' ? handleGeneralChat() : handleEditSubmit()} className="p-3 bg-white hover:bg-indigo-400 rounded-xl ml-2 transition-all"><Send className="w-5 h-5 text-black" /></button>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* --- DEVELOPER PROFILE --- */}
      {showDeveloper && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center p-6 animate-in zoom-in-95 duration-300">
           <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={() => setShowDeveloper(false)} />
           <div className="relative bg-zinc-900/60 border border-white/10 rounded-[2.5rem] p-8 max-w-sm w-full text-center">
              <button onClick={() => setShowDeveloper(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-all"><X className="w-5 h-5" /></button>
              
              <div className="mb-6 relative inline-block">
                <img src="https://raw.githubusercontent.com/gforg5/nanolens/main/myimg.jpg" 
                     onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1556157382-97eda2d62296?fit=crop&w=300&h=300&q=80" }} 
                     className="w-24 h-24 rounded-full mx-auto border-2 border-zinc-800 object-cover" />
              </div>
              
              <h2 className="text-xl font-bold tracking-tight mb-1">Sayed Mohsin Ali</h2>
              <p className="text-indigo-400 font-bold tracking-widest text-[9px] uppercase mb-6 flex items-center justify-center gap-2">
                 <Aperture className="w-3 h-3" /> System Architect
              </p>
              
              <p className="text-zinc-500 text-[11px] leading-relaxed italic mb-8">
                "Developing the next generation of hyper-visual AI systems."
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <a href="https://github.com/gforg5" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 bg-zinc-800/80 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:bg-white hover:text-black transition-all">
                   <Github className="w-3 h-3" /> Github
                </a>
                <a href="https://www.linkedin.com/in/sayedmohsinali/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-3 bg-zinc-800/80 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-white/5 hover:bg-white hover:text-black transition-all">
                   <Linkedin className="w-3 h-3" /> LinkedIn
                </a>
              </div>
           </div>
        </div>
      )}

      {/* --- ARCHIVES --- */}
      {showHistory && (
        <div className="absolute inset-0 z-[100] flex animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/98" onClick={() => setShowHistory(false)} />
          <div className="relative w-full max-w-xs h-full bg-black border-r border-white/5 flex flex-col p-8 animate-in slide-in-from-left duration-500">
             <div className="flex justify-between items-center mb-12">
               <h2 className="text-xl font-bold uppercase tracking-[0.4em] text-white/40">History</h2>
               <button onClick={() => setShowHistory(false)} className="p-2 text-zinc-600 hover:text-white transition-all"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-none">
               {history.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4"><History className="w-8 h-8" /><p className="text-[8px] font-bold uppercase tracking-widest">No Logs Found</p></div>
               ) : (
                 history.map(item => (
                   <div key={item.id} onClick={() => { setCurrentFile(item); setAppState(AppState.VIEWING); setShowHistory(false); }} className="p-4 rounded-xl bg-zinc-900/30 border border-white/5 flex gap-4 cursor-pointer hover:bg-zinc-900 transition-all relative group">
                      <button 
                        onClick={(e) => deleteHistoryItem(e, item.id)} 
                        className="absolute -top-1 -right-1 p-1.5 bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="w-12 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-white/5">
                        <img src={item.preview} className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-[7px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{new Date(item.timestamp).toLocaleTimeString()}</p>
                        <p className="text-[10px] font-medium truncate text-zinc-500 group-hover:text-zinc-200">{item.analysis?.points?.[0] || "Image Log"}</p>
                      </div>
                   </div>
                 ))
               )}
             </div>
             
             {history.length > 0 && (
               <button onClick={clearAllHistory} className="mt-6 flex items-center justify-center gap-2 py-4 text-[9px] font-bold text-zinc-600 hover:text-red-500 uppercase tracking-[0.2em] transition-colors"><Trash2 className="w-3 h-3" /> Clear Archive</button>
             )}
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
        @keyframes pulseSlow {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.05); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}