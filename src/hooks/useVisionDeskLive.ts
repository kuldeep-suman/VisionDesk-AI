import { useCallback, useEffect, useRef, useState } from 'react';
import { ExecutedOperation } from '../types/visiondesk';

export type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseVisionDeskLiveOptions {
  onInputTranscript: (text: string) => void;
  onOutputTranscript: (text: string) => void;
  onOperation: (op: ExecutedOperation) => void;
  onError: (message: string) => void;
}

function pcmFloatToBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToFloat32Pcm(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }
  return float32;
}

export function useVisionDeskLive(options: UseVisionDeskLiveOptions) {
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speakingTimerRef = useRef<number | null>(null);

  const stopPlaybackQueue = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped sources
      }
    }
    activeSourcesRef.current.clear();
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setIsAiSpeaking(false);
  }, []);

  const scheduleAudioChunk = useCallback((base64Pcm: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;

    const float32 = base64ToFloat32Pcm(base64Pcm);
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setIsAiSpeaking(true);

    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
    }

    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        speakingTimerRef.current = window.setTimeout(() => {
          if (activeSourcesRef.current.size === 0) {
            setIsAiSpeaking(false);
          }
        }, 180);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    stopPlaybackQueue();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => undefined);
      inputCtxRef.current = null;
    }

    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => undefined);
      outputCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    setMicLevel(0);
    setIsAiSpeaking(false);
    setConnectionState('disconnected');
  }, [stopPlaybackQueue]);

  const connect = useCallback(async () => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();

      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        const source = inputCtx.createMediaStreamSource(micStream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const channel = event.inputBuffer.getChannelData(0);
          let sum = 0;
          for (let i = 0; i < channel.length; i++) {
            sum += channel[i] * channel[i];
          }
          const rms = Math.sqrt(sum / channel.length);
          setMicLevel(isMutedRef.current ? 0 : Math.min(1, rms * 6));

          if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
          const base64 = pcmFloatToBase64(channel);
          ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            setConnectionState('connected');
          } else if (msg.type === 'audio' && typeof msg.data === 'string') {
            scheduleAudioChunk(msg.data);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'inputTranscript' && typeof msg.text === 'string') {
            optionsRef.current.onInputTranscript(msg.text);
          } else if (msg.type === 'outputTranscript' && typeof msg.text === 'string') {
            optionsRef.current.onOutputTranscript(msg.text);
          } else if (msg.type === 'operation' && msg.operation) {
            optionsRef.current.onOperation(msg.operation);
          } else if (msg.type === 'error') {
            optionsRef.current.onError(msg.message || 'Live voice session error');
            setConnectionState('error');
          } else if (msg.type === 'closed') {
            setConnectionState('disconnected');
          }
        } catch (err) {
          console.error('Failed to handle live WS payload:', err);
        }
      };

      ws.onerror = () => {
        optionsRef.current.onError('Unable to maintain live audio stream.');
        setConnectionState('error');
      };

      ws.onclose = () => {
        disconnect();
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone permission is required for real-time voice conversation.';
      optionsRef.current.onError(msg);
      disconnect();
      setConnectionState('error');
    }
  }, [connectionState, disconnect, scheduleAudioChunk, stopPlaybackQueue]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const sendVideoFrame = useCallback((base64Jpeg: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'video', data: base64Jpeg }));
    }
  }, []);

  const sendLiveText = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text', text }));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    isMuted,
    isAiSpeaking,
    micLevel,
    connect,
    disconnect,
    toggleMute,
    sendVideoFrame,
    sendLiveText,
  };
}
