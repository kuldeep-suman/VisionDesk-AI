import React from 'react';

interface VisionOrbProps {
  mode: 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking';
  micLevel: number;
}

export const VisionOrb: React.FC<VisionOrbProps> = ({ mode, micLevel }) => {
  const dynamicScale =
    mode === 'listening'
      ? 1 + micLevel * 0.16
      : mode === 'speaking'
      ? 1.07
      : mode === 'thinking'
      ? 1.03
      : 1;

  const statusLabel =
    mode === 'speaking'
      ? 'VisionDesk Speaking'
      : mode === 'listening'
      ? 'Listening to Visitor'
      : mode === 'connecting'
      ? 'Establishing Voice Link'
      : mode === 'thinking'
      ? 'Processing Request'
      : 'Ready at Main Reception';

  const ringColor =
    mode === 'speaking'
      ? 'border-sky-400/70'
      : mode === 'listening'
      ? 'border-blue-400/70'
      : mode === 'thinking'
      ? 'border-amber-400/60'
      : 'border-sky-700/40';

  const coreGradient =
    mode === 'speaking'
      ? 'from-sky-400 via-blue-500 to-indigo-700'
      : mode === 'listening'
      ? 'from-blue-400 via-sky-500 to-slate-800'
      : mode === 'thinking'
      ? 'from-amber-400/80 via-sky-500 to-blue-800'
      : 'from-sky-500/80 via-blue-700 to-slate-900';

  return (
    <div className="flex flex-col items-center justify-center py-4 select-none">
      <div className="relative flex h-36 w-36 items-center justify-center">
        {(mode === 'listening' || mode === 'speaking') && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full border ${ringColor} animate-orb-ring`}
          />
        )}
        <span
          aria-hidden="true"
          className={`absolute inset-3 rounded-full border ${ringColor} transition-transform duration-150`}
          style={{ transform: `scale(${dynamicScale})` }}
        />
        <div
          className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${coreGradient} shadow-[0_0_40px_rgba(56,189,248,0.22)] transition-transform duration-150 animate-orb-breathe`}
          style={{ transform: `scale(${dynamicScale})` }}
        >
          <div className="flex items-end gap-1 h-7" aria-hidden="true">
            {[0.45, 0.85, 1, 0.72, 0.5].map((bar, idx) => {
              const activeHeight =
                mode === 'speaking'
                  ? `${Math.round(45 + ((idx * 19) % 50))}%`
                  : mode === 'listening'
                  ? `${Math.max(24, Math.min(100, Math.round(bar * 35 + micLevel * 75)))}%`
                  : mode === 'thinking'
                  ? `${Math.round(35 + idx * 8)}%`
                  : `${Math.round(bar * 34)}%`;
              return (
                <span
                  key={idx}
                  className="w-1 rounded-full bg-white/90 transition-all duration-100"
                  style={{ height: activeHeight }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs font-medium tracking-wide text-slate-300">
        {(mode === 'listening' || mode === 'speaking') && (
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              mode === 'speaking' ? 'bg-sky-400' : 'bg-blue-400'
            }`}
          />
        )}
        <span>{statusLabel}</span>
      </div>
    </div>
  );
};
