"use client";

interface AttitudeIndicatorProps {
  rollDegrees: number | null;
  pitchDegrees: number | null;
}

const PITCH_SCALE = 2;
const MAX_PITCH_OFFSET = 25;

export function AttitudeIndicator({ rollDegrees, pitchDegrees }: AttitudeIndicatorProps) {
  const roll = rollDegrees ?? 0;
  const pitch = pitchDegrees ?? 0;
  const pitchOffset = Math.max(-MAX_PITCH_OFFSET, Math.min(MAX_PITCH_OFFSET, pitch * PITCH_SCALE));

  return (
    <div className="cockpit-panel overflow-hidden p-1" style={{ width: 100, height: 100 }}>
      <svg width="92" height="92" viewBox="0 0 92 92" className="overflow-hidden rounded-full">
        <defs>
          <clipPath id="attitude-clip">
            <circle cx="46" cy="46" r="40" />
          </clipPath>
        </defs>

        <circle cx="46" cy="46" r="40" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

        <g clipPath="url(#attitude-clip)">
          <g transform={`rotate(${-roll}, 46, 46) translate(0, ${pitchOffset})`}>
            <rect x="-20" y="-60" width="132" height="106" fill="#1a4a7a" />
            <rect x="-20" y="46" width="132" height="106" fill="#5a3a1a" />
            <line x1="-20" y1="46" x2="112" y2="46" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />

            {[-20, -10, 10, 20].map((deg) => {
              const y = 46 - deg * PITCH_SCALE;
              const halfWidth = Math.abs(deg) === 20 ? 12 : 8;
              return (
                <line key={deg} x1={46 - halfWidth} y1={y} x2={46 + halfWidth} y2={y}
                  stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
              );
            })}
          </g>
        </g>

        <line x1="26" y1="46" x2="40" y2="46" stroke="#0468b1" strokeWidth="2" />
        <line x1="52" y1="46" x2="66" y2="46" stroke="#0468b1" strokeWidth="2" />
        <circle cx="46" cy="46" r="2" fill="none" stroke="#0468b1" strokeWidth="1.5" />

        {[-30, -20, -10, 0, 10, 20, 30].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const outerR = 39;
          const innerR = deg === 0 ? 33 : 36;
          const x1 = 46 + innerR * Math.cos(rad);
          const y1 = 46 + innerR * Math.sin(rad);
          const x2 = 46 + outerR * Math.cos(rad);
          const y2 = 46 + outerR * Math.sin(rad);
          return (
            <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={deg === 0 ? "#e4002b" : "rgba(255,255,255,0.4)"} strokeWidth={deg === 0 ? 2 : 1} />
          );
        })}
      </svg>
    </div>
  );
}
