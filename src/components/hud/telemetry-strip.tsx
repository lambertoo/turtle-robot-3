"use client";

import type { RobotVelocity } from "@/hooks/use-map-subscription";

interface TelemetryStripProps {
  headingDegrees: number | null;
  velocity: RobotVelocity | null;
}

function TelemetryCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col items-center px-3">
      <span className="font-mono-data text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono-data text-sm font-bold text-white">{value}</span>
        <span className="font-mono-data text-xs text-white/50">{unit}</span>
      </div>
    </div>
  );
}

export function TelemetryStrip({ headingDegrees, velocity }: TelemetryStripProps) {
  const linearSpeed = velocity ? Math.abs(velocity.linearX) : 0;
  const angularSpeed = velocity ? Math.abs(velocity.angularZ) : 0;
  const heading = headingDegrees ?? 0;

  return (
    <div className="cockpit-panel flex items-center divide-x divide-white/10 py-2">
      <TelemetryCell label="SPD" value={linearSpeed.toFixed(2)} unit="m/s" />
      <TelemetryCell label="ROT" value={(angularSpeed * (180 / Math.PI)).toFixed(1)} unit="°/s" />
      <TelemetryCell label="HDG" value={heading.toFixed(0)} unit="°" />
    </div>
  );
}
