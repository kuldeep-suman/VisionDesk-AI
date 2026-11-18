import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Camera,
  CameraOff,
  FileUp,
  GraduationCap,
  HelpCircle,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ScanEye,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { useVisionDeskLive } from '../hooks/useVisionDeskLive';
import {
  ConversationMessage,
  Department,
  ExecutedOperation,
  FacultyMember,
} from '../types/visiondesk';
import { OperationCards } from './OperationCards';
import { QuickModalType } from './QuickOperationModals';
import { VisionOrb } from './VisionOrb';

interface ReceptionDeskProps {
  departments: Department[];
  facultyList: FacultyMember[];
  pendingQuickPrompt: string | null;
  onConsumeQuickPrompt: () => void;
  onOpenModal: (type: QuickModalType) => void;
  onNavigate: (view: 'departments' | 'faculty') => void;
  latestOperation: ExecutedOperation | null;
  onOperationResult: (op: ExecutedOperation) => void;
}

export const ReceptionDesk: React.FC<ReceptionDeskProps> = ({
  departments,
  pendingQuickPrompt,
  onConsumeQuickPrompt,
  onOpenModal,
  onNavigate,
  latestOperation,
  onOperationResult,
}) => {
  const [interactionMode, setInteractionMode] = useState<'voice' | 'text'>('voice');
  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: 'Welcome to Career Point University. I am VisionDesk, your virtual receptionist. How may I assist you today?',
      source: 'text',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [textInput, setTextInput] = useState('');
  const [sendingText, setSendingText] = useState(false);
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const [visionAnalysis, setVisionAnalysis] = useState<string | null>(null);
  const [analyzingVision, setAnalyzingVision] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Camera & Visitor Presence Detection State
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<'idle' | 'detected'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const prevFrameSamplesRef = useRef<Uint8ClampedArray | null>(null);
  const lastPresenceGreetingAtRef = useRef<number>(0);
  const consecutiveMotionFramesRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const appendMessage = useCallback(
    (role: 'user' | 'model', text: string, source: 'voice' | 'text' | 'vision') => {
      const clean = text.trim();
      if (!clean) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role && last.source === 'voice' && source === 'voice') {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: `${last.text} ${clean}`.replace(/\s+/g, ' ').trim(),
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            role,
            text: clean,
            source,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ];
      });
    },
    []
  );

  const {
    connectionState,
    isMuted,
    isAiSpeaking,
    micLevel,
    connect,
    disconnect,
    toggleMute,
    sendVideoFrame,
    sendLiveText,
  } = useVisionDeskLive({
    onInputTranscript: (t) => appendMessage('user', t, 'voice'),
    onOutputTranscript: (t) => appendMessage('model', t, 'voice'),
    onOperation: (op) => {
      onOperationResult(op);
    },
    onError: (msg) => setErrorBanner(msg),
  });

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendTextMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || sendingText) return;

      setErrorBanner(null);
      appendMessage('user', trimmed, 'text');
      setTextInput('');

      // If a live voice call is active, route prompt directly into the Live session so VisionDesk speaks back!
      if (connectionState === 'connected') {
        const sent = sendLiveText(trimmed);
        if (sent) return;
      }

      setSendingText(true);
      try {
        const historyPayload = messages.slice(-10).map((m) => ({
          role: m.role,
          text: m.text,
        }));
        const res = await fetch('/api/reception/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to process request.');

        if (Array.isArray(data.operations) && data.operations.length > 0) {
          onOperationResult(data.operations[data.operations.length - 1]);
        }
        appendMessage('model', data.reply, 'text');
      } catch (err: unknown) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Unable to reach VisionDesk service.'
        );
      } finally {
        setSendingText(false);
      }
    },
    [appendMessage, connectionState, messages, onOperationResult, sendLiveText, sendingText]
  );

  useEffect(() => {
    if (pendingQuickPrompt) {
      sendTextMessage(pendingQuickPrompt);
      onConsumeQuickPrompt();
    }
  }, [pendingQuickPrompt, onConsumeQuickPrompt, sendTextMessage]);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    prevFrameSamplesRef.current = null;
    consecutiveMotionFramesRef.current = 0;
    setCameraEnabled(false);
    setPresenceStatus('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setErrorBanner(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraEnabled(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 60);
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error
          ? `Camera access denied or unavailable: ${err.message}`
          : 'Camera permission is required to enable live vision.'
      );
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraEnabled) return;

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const width = 320;
      const height = 240;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(video, 0, 0, width, height);

      // Lightweight privacy-preserving local presence detection via frame-delta luminance
      const frameData = ctx.getImageData(0, 0, width, height).data;
      const sampleCount = 640;
      const step = Math.floor(frameData.length / 4 / sampleCount) * 4;
      const currentSamples = new Uint8ClampedArray(sampleCount);
      let diffSum = 0;
      let idx = 0;

      for (let i = 0; i < frameData.length && idx < sampleCount; i += step) {
        const lum = Math.round(
          0.299 * frameData[i] + 0.587 * frameData[i + 1] + 0.114 * frameData[i + 2]
        );
        currentSamples[idx] = lum;
        if (prevFrameSamplesRef.current) {
          diffSum += Math.abs(lum - prevFrameSamplesRef.current[idx]);
        }
        idx++;
      }

      const avgDiff = prevFrameSamplesRef.current ? diffSum / sampleCount : 0;
      prevFrameSamplesRef.current = currentSamples;

      if (avgDiff > 10) {
        consecutiveMotionFramesRef.current += 1;
        if (consecutiveMotionFramesRef.current >= 2) {
          setPresenceStatus('detected');
          const now = Date.now();
          if (now - lastPresenceGreetingAtRef.current > 45000) {
            lastPresenceGreetingAtRef.current = now;
            if (connectionState === 'connected') {
              sendLiveText(
                'A visitor just stepped up to the reception camera. Warmly welcome them to Career Point University, Kota and ask how you can help.'
              );
            } else {
              appendMessage(
                'model',
                'Namaste! Welcome to Career Point University, Kota. I see you have arrived at the reception desk. How may I assist you today?',
                'vision'
              );
            }
          }
        }
      } else {
        consecutiveMotionFramesRef.current = Math.max(0, consecutiveMotionFramesRef.current - 1);
        if (consecutiveMotionFramesRef.current === 0) {
          setPresenceStatus('idle');
        }
      }

      // Stream JPEG at 1 FPS when Live Voice call is active
      if (connectionState === 'connected') {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        const base64 = dataUrl.split(',')[1];
        if (base64) {
          sendVideoFrame(base64);
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [appendMessage, cameraEnabled, connectionState, sendLiveText, sendVideoFrame]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const analyzeImagePayload = async (
    base64: string,
    mimeType: string,
    source: 'camera' | 'upload'
  ) => {
    setAnalyzingVision(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/reception/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Visual analysis failed.');
      setVisionAnalysis(data.analysis);
      appendMessage('model', data.analysis, 'vision');
    } catch (err: unknown) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to analyze image at this moment.'
      );
    } finally {
      setAnalyzingVision(false);
    }
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraEnabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    if (base64) {
      analyzeImagePayload(base64, 'image/jpeg', 'camera');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1];
      if (base64) {
        analyzeImagePayload(base64, file.type || 'image/jpeg', 'upload');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickCheckout = async (visitorCode: string) => {
    try {
      const res = await fetch('/api/reception/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-out failed.');
      onOperationResult({ tool: 'checkout_visitor', status: 'success', data });
      appendMessage(
        'model',
        `Visitor pass ${visitorCode} has been checked out cleanly. Thank you for visiting Career Point University, Kota.`,
        'text'
      );
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to check out visitor.');
    }
  };

  const orbMode =
    connectionState === 'connecting'
      ? 'connecting'
      : isAiSpeaking
      ? 'speaking'
      : connectionState === 'connected'
      ? 'listening'
      : sendingText || analyzingVision
      ? 'thinking'
      : 'idle';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-[#0C1729]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-sky-400">
                <span>Career Point University, Kota</span>
                <span aria-hidden="true">·</span>
                <span>Alaniya, Jhalawar Road</span>
                <span aria-hidden="true">·</span>
                <span>Mon–Sat, 9:00 AM – 5:00 PM</span>
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white text-balance leading-snug">
                Welcome to Career Point University. I am VisionDesk, your virtual receptionist. How may I assist you today?
              </h1>
              <p className="mt-2.5 text-sm text-slate-300 leading-relaxed max-w-2xl">
                Speak naturally in English, Hindi, or Hinglish, enable live camera vision for document checks, or select an instant reception service below.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {connectionState === 'connected' ? (
                <>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                      isMuted
                        ? 'border-amber-600/60 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                        : 'border-slate-700 bg-[#060D1A] text-white hover:border-sky-500/60'
                    }`}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-sky-400" />}
                    <span>{isMuted ? 'Unmute Microphone' : 'Mute Microphone'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={disconnect}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>End Voice Call</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode('voice');
                    connect();
                  }}
                  disabled={connectionState === 'connecting'}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>
                    {connectionState === 'connecting'
                      ? 'Connecting Voice...'
                      : 'Start Real-Time Voice'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={cameraEnabled ? stopCamera : startCamera}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  cameraEnabled
                    ? 'border-sky-500/60 bg-sky-950/40 text-sky-200 hover:bg-sky-900/40'
                    : 'border-slate-700 bg-[#060D1A] text-slate-200 hover:border-sky-500/50 hover:text-white'
                }`}
              >
                {cameraEnabled ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                <span>{cameraEnabled ? 'Disable Camera' : 'Enable Camera Vision'}</span>
              </button>

              <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#060D1A] p-1">
                <button
                  type="button"
                  onClick={() => setInteractionMode('voice')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    interactionMode === 'voice'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Voice + Text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInteractionMode('text');
                    if (connectionState === 'connected') disconnect();
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    interactionMode === 'text'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Text Mode
                </button>
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-5 min-h-[210px] overflow-hidden border-t lg:border-t-0 lg:border-l border-slate-800/80">
            <img
              src="/src/assets/images/cpu_campus_hero_1794839190491.jpg"
              alt="Career Point University Kota Campus Building at Dusk"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060D1A]/90 via-[#060D1A]/35 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-200">
              <span>Main Reception Atrium</span>
              <span className="text-slate-300">Kota, Rajasthan</span>
            </div>
          </div>
        </div>
      </section>

      {errorBanner && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-xs font-medium text-red-300 hover:text-white whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Reception Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left Column: AI Presence & Live Camera Vision */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-xl border border-slate-800/90 bg-[#0C1729] p-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white">Live Voice &amp; Acoustic Presence</h2>
              <span className="text-xs text-slate-400">
                {connectionState === 'connected'
                  ? isMuted
                    ? 'Mic Muted'
                    : 'Live Audio Active'
                  : 'Standby'}
              </span>
            </div>

            <VisionOrb mode={orbMode} micLevel={micLevel} />

            <div className="mt-2 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-slate-800 bg-[#060D1A] px-3 py-2.5">
                <div className="text-slate-400">Languages</div>
                <div className="mt-0.5 font-medium text-slate-100">
                  English · Hindi · Hinglish
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#060D1A] px-3 py-2.5">
                <div className="text-slate-400">Microphone</div>
                <div className="mt-0.5 font-medium text-slate-100">
                  {connectionState === 'connected'
                    ? isMuted
                      ? 'Muted'
                      : 'Receiving 16kHz PCM'
                    : 'Click Start Voice'}
                </div>
              </div>
            </div>
          </div>

          {/* Live Camera Vision Panel */}
          <div className="flex-1 flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0C1729] p-5">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <h2 className="text-sm font-semibold text-white">Live Camera &amp; Document Vision</h2>
                <span className="text-xs text-slate-400">
                  {cameraEnabled
                    ? presenceStatus === 'detected'
                      ? 'Visitor Presence Detected'
                      : 'Camera Observing'
                    : 'Camera Off (Private)'}
                </span>
              </div>

              <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg border border-slate-800 bg-[#060D1A] flex items-center justify-center">
                {cameraEnabled ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="px-6 text-center space-y-2">
                    <Camera className="mx-auto h-7 w-7 text-slate-500" />
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enable camera only with your permission for automatic visitor greeting or live document reading. No camera frames are saved automatically.
                    </p>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCaptureCameraFrame}
                disabled={!cameraEnabled || analyzingVision}
                className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-lg border border-sky-700/50 bg-sky-950/40 px-3 py-2.5 text-xs font-medium text-sky-200 hover:bg-sky-800/50 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <ScanEye className="h-4 w-4" />
                <span>{analyzingVision ? 'Analyzing...' : 'Observe Camera Frame'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzingVision}
                className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-2.5 text-xs font-medium text-slate-200 hover:border-sky-500/50 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                <FileUp className="h-4 w-4" />
                <span>Upload Photo / Document</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Quick Reception Actions, Live Results & Conversation */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Quick Reception Actions */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0C1729] p-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white">Reception Quick Actions</h2>
              <span className="text-xs text-slate-400">Touch or Voice Enabled</span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => onOpenModal('register')}
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <UserPlus className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Register as Visitor</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('departments')}
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <Building2 className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Find a Department</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('faculty')}
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <Users className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Meet a Faculty Member</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  sendTextMessage(
                    'I need admission assistance and directions to the Admissions & Counseling Cell at Career Point University.'
                  )
                }
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <GraduationCap className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Admission Assistance</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenModal('appointment')}
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <CalendarClock className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Appointment Request</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOtherMenu((prev) => !prev)}
                className="min-h-[46px] flex items-center gap-2.5 rounded-lg border border-slate-800 bg-[#060D1A] px-3.5 py-2.5 text-left text-xs font-medium text-slate-100 hover:border-sky-500/60 hover:bg-sky-950/30 transition-colors"
              >
                <HelpCircle className="h-4 w-4 text-sky-400 shrink-0" />
                <span className="whitespace-nowrap">Other Assistance</span>
              </button>
            </div>

            {showOtherMenu && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherMenu(false);
                    sendTextMessage('Where is the Examination Cell and what are its timings?');
                  }}
                  className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-500/50 whitespace-nowrap"
                >
                  Examination Cell
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherMenu(false);
                    sendTextMessage('Where is the Accounts and Fee Counter located?');
                  }}
                  className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-500/50 whitespace-nowrap"
                >
                  Accounts &amp; Fees
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherMenu(false);
                    onOpenModal('complaint');
                  }}
                  className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-500/50 whitespace-nowrap"
                >
                  Register Complaint
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherMenu(false);
                    onOpenModal('checkout');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-500/50 whitespace-nowrap"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Visitor Check-Out</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherMenu(false);
                    sendTextMessage(
                      'What are Career Point University office timings and campus address?'
                    );
                  }}
                  className="rounded-lg border border-slate-700 bg-[#060D1A] px-3 py-1.5 text-xs text-slate-200 hover:border-sky-500/50 whitespace-nowrap"
                >
                  Office Timings
                </button>
              </div>
            )}
          </div>

          {/* Live Database Operation Output */}
          <OperationCards
            operation={latestOperation}
            visionAnalysis={visionAnalysis}
            onQuickCheckout={handleQuickCheckout}
          />

          {/* Live Conversation Transcript + Text Mode Input */}
          <div className="flex-1 flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0C1729] p-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-sky-400 shrink-0" />
                <h2 className="text-sm font-semibold text-white">Reception Conversation</h2>
              </div>
              <span className="text-xs text-slate-400">
                {messages.length} turns
              </span>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto space-y-3 pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{msg.role === 'user' ? 'Visitor' : 'VisionDesk'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{msg.timestamp}</span>
                  </div>
                  <div
                    className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white'
                        : 'border border-slate-800 bg-[#060D1A] text-slate-100'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {sendingText && (
                <div className="text-xs text-slate-400">VisionDesk is responding...</div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendTextMessage(textInput);
              }}
              className="mt-4 flex items-center gap-2 border-t border-slate-800/80 pt-3"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type in English, Hindi, or Hinglish (e.g. 'CSE department kahan hai?')..."
                className="flex-1 rounded-lg border border-slate-700 bg-[#060D1A] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!textInput.trim() || sendingText}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
