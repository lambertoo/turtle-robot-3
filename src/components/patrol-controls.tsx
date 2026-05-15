"use client";

import { useTranslations } from "next-intl";

interface PatrolWaypoint {
  x: number;
  y: number;
}

interface PatrolControlsProps {
  waypoints: PatrolWaypoint[];
  isLooping: boolean;
  isPatrolRunning: boolean;
  currentWaypointIndex: number;
  onToggleLoop: () => void;
  onStart: () => void;
  onClear: () => void;
  onRemoveWaypoint: (index: number) => void;
}

export function PatrolControls({
  waypoints,
  isLooping,
  isPatrolRunning,
  currentWaypointIndex,
  onToggleLoop,
  onStart,
  onClear,
  onRemoveWaypoint,
}: PatrolControlsProps) {
  const t = useTranslations("operations.patrol");

  return (
    <div className="hud-panel absolute bottom-4 left-4 z-20 flex flex-col gap-3 rounded-xl p-4" style={{ width: 260 }}>
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {t("title")}
        </span>
        <span className="font-mono-data text-xs text-[var(--color-accent-amber)]">
          {waypoints.length > 0
            ? t("waypointCount", { count: waypoints.length })
            : t("noWaypoints")}
        </span>
      </div>

      {waypoints.length > 0 && (
        <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
          {waypoints.map((waypoint, index) => (
            <div
              key={index}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs font-mono-data ${
                isPatrolRunning && index === currentWaypointIndex
                  ? "bg-[rgba(245,158,11,0.2)] text-[var(--color-accent-amber)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              <span>
                #{index + 1} ({waypoint.x.toFixed(1)}, {waypoint.y.toFixed(1)})
              </span>
              {!isPatrolRunning && (
                <button
                  onClick={() => onRemoveWaypoint(index)}
                  className="rounded p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-red)] transition"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="11" y2="11" />
                    <line x1="11" y1="1" x2="1" y2="11" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {waypoints.length === 0 && (
        <p className="text-xs text-[var(--color-text-secondary)] text-center py-2">
          {t("clickMapToAdd")}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleLoop}
          disabled={isPatrolRunning}
          className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
            isLooping
              ? "bg-[var(--color-accent-amber)] text-black"
              : "bg-[rgba(245,158,11,0.15)] text-[var(--color-accent-amber)] border border-[var(--color-accent-amber)]/30"
          } disabled:opacity-40`}
        >
          {isLooping ? t("loop") : t("runOnce")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onStart}
          disabled={waypoints.length < 2 || isPatrolRunning}
          className="flex-1 rounded-lg bg-[var(--color-accent-green)] px-3 py-2 text-sm font-bold uppercase tracking-wider text-black transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("start")}
        </button>
        <button
          onClick={onClear}
          disabled={isPatrolRunning}
          className="rounded-lg border border-[var(--color-accent-red)]/30 bg-[rgba(228,0,43,0.1)] px-3 py-2 text-sm font-bold uppercase tracking-wider text-[var(--color-accent-red)] transition hover:bg-[rgba(228,0,43,0.2)] active:scale-95 disabled:opacity-40"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}
