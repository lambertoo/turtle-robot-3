"use client";

const CARDINAL_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const TICK_COUNT = 36;

interface CompassHudProps {
  headingDegrees: number | null;
}

export function CompassHud({ headingDegrees }: CompassHudProps) {
  const heading = headingDegrees ?? 0;
  const cardinalIndex = Math.round(heading / 45) % 8;
  const cardinal = CARDINAL_DIRECTIONS[cardinalIndex];
  const hasData = headingDegrees !== null;

  return (
    <div className="cockpit-panel flex flex-col items-center gap-1 p-2" style={{ width: 88 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        <g transform={`rotate(${-heading}, 32, 32)`}>
          {Array.from({ length: TICK_COUNT }).map((_, i) => {
            const angle = (i * 360) / TICK_COUNT;
            const isMajor = i % 9 === 0;
            const outerRadius = 27;
            const innerRadius = isMajor ? 21 : 24;
            const rad = (angle * Math.PI) / 180;
            const x1 = 32 + innerRadius * Math.sin(rad);
            const y1 = 32 - innerRadius * Math.cos(rad);
            const x2 = 32 + outerRadius * Math.sin(rad);
            const y2 = 32 - outerRadius * Math.cos(rad);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={isMajor ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"}
                strokeWidth={isMajor ? 1.5 : 0.5}
              />
            );
          })}

          <text x="32" y="10" textAnchor="middle" fill="#e4002b" fontSize="8" fontWeight="bold" fontFamily="monospace">N</text>
          <text x="54" y="35" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">E</text>
          <text x="32" y="58" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">S</text>
          <text x="10" y="35" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="monospace">W</text>
        </g>

        <polygon points="32,12 34,20 30,20" fill="#e4002b" />
        <polygon points="32,52 34,44 30,44" fill="rgba(255,255,255,0.3)" />
        <circle cx="32" cy="32" r="2" fill="#0468b1" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      </svg>

      <div className="flex items-baseline gap-1">
        <span className={`font-mono-data text-sm font-bold ${hasData ? "text-white" : "text-white/30"}`}>
          {heading.toFixed(0)}°
        </span>
        <span className={`font-mono-data text-xs ${hasData ? "text-white/60" : "text-white/20"}`}>
          {cardinal}
        </span>
      </div>
    </div>
  );
}
