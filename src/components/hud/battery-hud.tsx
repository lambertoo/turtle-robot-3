"use client";

interface BatteryHudProps {
  voltage: number | null;
  percentage: number | null;
}

export function BatteryHud({ voltage, percentage }: BatteryHudProps) {
  if (voltage === null || voltage === undefined) return null;

  const isCritical = voltage < 10.5;
  const isLow = voltage < 11.1;
  const batteryColor = isCritical ? "#e4002b" : isLow ? "#f59e0b" : "#56c5d0";
  const pct = percentage ?? 0;
  const barWidth = Math.max(1, Math.min(14, (pct / 100) * 14));

  return (
    <div className={`cockpit-panel flex items-center gap-2 px-3 py-2 ${isCritical ? "animate-pulse" : ""}`}>
      <svg width="20" height="14" viewBox="0 0 24 16">
        <rect x="1" y="1" width="18" height="14" rx="2" ry="2" fill="none" stroke={batteryColor} strokeWidth="1.5" />
        <rect x="19" y="5" width="3" height="6" rx="1" fill={batteryColor} />
        <rect x="3" y="3" width={barWidth} height="10" rx="1" fill={batteryColor} opacity="0.8" />
      </svg>
      <div className="flex flex-col">
        <span className="font-mono-data text-sm font-bold leading-tight" style={{ color: batteryColor }}>
          {voltage.toFixed(1)}V
        </span>
        <span className="font-mono-data text-xs leading-tight text-white/50">
          {pct.toFixed(0)}%
        </span>
      </div>
      {isLow && (
        <span className={`font-mono-data text-xs font-bold uppercase tracking-wider ${isCritical ? "text-[#e4002b] animate-blink" : "text-[#f59e0b]"}`}>
          {isCritical ? "CRIT" : "LOW"}
        </span>
      )}
    </div>
  );
}
