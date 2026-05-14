"use client";

import { useTranslations } from "next-intl";
import type { CleaningState } from "@/hooks/use-cleaning";
import type { SavedMap } from "@/lib/map-storage";

interface CleaningControlsProps {
  cleaningState: CleaningState;
  onSelectMap: (map: SavedMap) => void;
  onStartCleaning: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDone: () => void;
}

function formatElapsedTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

const cleaningIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h4L12 3h0l5 18h4" />
    <path d="M7.5 15h9" />
  </svg>
);

function SelectMapPhase({
  savedMaps,
  onSelectMap,
  onCancel,
}: {
  savedMaps: SavedMap[];
  onSelectMap: (map: SavedMap) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("cleaning");

  if (savedMaps.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {t("selectMap")}
        </span>
        <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">
          {t("noMaps")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
        {t("selectMap")}
      </span>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {savedMaps.map((savedMap) => (
          <button
            key={savedMap.id}
            onClick={() => onSelectMap(savedMap)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--color-surface-hover)]"
            style={{ border: "1px solid rgba(34,197,94,0.15)" }}
          >
            <span className="text-[var(--color-accent-green)]">{cleaningIcon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{savedMap.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {new Date(savedMap.savedAt).toLocaleDateString()}
              </p>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

function PlanningPhase({
  waypointCount,
  onStartCleaning,
  onCancel,
}: {
  waypointCount: number;
  onStartCleaning: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("cleaning");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-[rgba(34,197,94,0.1)] px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent-green)]" />
        <span className="font-mono-data text-xs text-[var(--color-accent-green)]">
          {t("waypointCount", { count: waypointCount })}
        </span>
      </div>
      <button
        onClick={onStartCleaning}
        className="w-full rounded-xl bg-[var(--color-accent-green)] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-95"
        style={{ boxShadow: "0 0 15px rgba(34,197,94,0.3)" }}
      >
        {t("startCleaning")}
      </button>
      <button
        onClick={onCancel}
        className="rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
      >
        {t("cancel")}
      </button>
    </div>
  );
}

function CleaningPhaseDisplay({
  currentWaypointIndex,
  totalWaypoints,
  progressPercent,
  elapsedSeconds,
  onPause,
  onStop,
}: {
  currentWaypointIndex: number;
  totalWaypoints: number;
  progressPercent: number;
  elapsedSeconds: number;
  onPause: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("cleaning");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-[rgba(34,197,94,0.1)] px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
        <span className="font-mono-data text-xs text-[var(--color-accent-green)]">
          {t("waypointProgress", { current: currentWaypointIndex, total: totalWaypoints })}
        </span>
      </div>

      <div className="w-full rounded-full h-2 bg-[rgba(255,255,255,0.1)]">
        <div
          className="h-2 rounded-full bg-[var(--color-accent-green)] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] font-mono-data">
        <span>{t("progressPercent", { percent: progressPercent })}</span>
        <span>{t("elapsed", { time: formatElapsedTime(elapsedSeconds) })}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onPause}
          className="flex-1 rounded-lg border border-[var(--color-accent-amber)]/30 bg-[rgba(245,158,11,0.1)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent-amber)] transition hover:bg-[rgba(245,158,11,0.2)] active:scale-95"
        >
          {t("pause")}
        </button>
        <button
          onClick={onStop}
          className="flex-1 rounded-lg border border-[var(--color-accent-red)]/30 bg-[rgba(228,0,43,0.1)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent-red)] transition hover:bg-[rgba(228,0,43,0.2)] active:scale-95"
        >
          {t("stop")}
        </button>
      </div>
    </div>
  );
}

function PausedPhaseDisplay({
  currentWaypointIndex,
  totalWaypoints,
  elapsedSeconds,
  onResume,
  onStop,
}: {
  currentWaypointIndex: number;
  totalWaypoints: number;
  elapsedSeconds: number;
  onResume: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("cleaning");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-[rgba(245,158,11,0.1)] px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-[var(--color-accent-amber)]" />
        <span className="font-mono-data text-xs text-[var(--color-accent-amber)]">
          {t("waypointProgress", { current: currentWaypointIndex, total: totalWaypoints })}
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("elapsed", { time: formatElapsedTime(elapsedSeconds) })}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 rounded-xl bg-[var(--color-accent-green)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-95"
        >
          {t("resume")}
        </button>
        <button
          onClick={onStop}
          className="flex-1 rounded-lg border border-[var(--color-accent-red)]/30 bg-[rgba(228,0,43,0.1)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-accent-red)] transition hover:bg-[rgba(228,0,43,0.2)] active:scale-95"
        >
          {t("stop")}
        </button>
      </div>
    </div>
  );
}

function CompletedPhaseDisplay({
  totalWaypoints,
  missedWaypoints,
  elapsedSeconds,
  onDone,
}: {
  totalWaypoints: number;
  missedWaypoints: number[];
  elapsedSeconds: number;
  onDone: () => void;
}) {
  const t = useTranslations("cleaning");

  return (
    <div className="flex flex-col gap-3 items-center py-2">
      <div className="flex items-center gap-2 rounded-lg bg-[rgba(34,197,94,0.15)] px-4 py-3">
        <span className="font-mono-data text-sm font-bold text-[var(--color-accent-green)]">
          {t("complete")}
        </span>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] font-mono-data text-center">
        <p>{t("waypointProgress", { current: totalWaypoints, total: totalWaypoints })}</p>
        <p>{t("elapsed", { time: formatElapsedTime(elapsedSeconds) })}</p>
        {missedWaypoints.length > 0 && (
          <p className="text-[var(--color-accent-amber)] mt-1">
            {t("missed", { count: missedWaypoints.length })}
          </p>
        )}
      </div>
      <button
        onClick={onDone}
        className="w-full rounded-xl bg-[var(--color-accent-blue)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-95"
      >
        {t("done")}
      </button>
    </div>
  );
}

export function CleaningControls({
  cleaningState,
  onSelectMap,
  onStartCleaning,
  onPause,
  onResume,
  onStop,
  onDone,
}: CleaningControlsProps) {
  const t = useTranslations("cleaning");

  return (
    <div className="cockpit-panel flex flex-col gap-3 p-4" style={{ width: 280 }}>
      {(cleaningState.phase === "idle" || cleaningState.phase === "select-map") && (
        <SelectMapPhase
          savedMaps={cleaningState.savedMaps}
          onSelectMap={onSelectMap}
          onCancel={onStop}
        />
      )}

      {cleaningState.phase === "loading-map" && (
        <div className="flex flex-col gap-3 items-center py-4">
          <div className="h-6 w-6 rounded-full border-2 border-[var(--color-accent-green)] border-t-transparent animate-spin" />
          <span className="font-mono-data text-xs text-[var(--color-text-secondary)]">
            {t("loadingMap")}
          </span>
        </div>
      )}

      {cleaningState.phase === "planning" && (
        <PlanningPhase
          waypointCount={cleaningState.totalWaypoints}
          onStartCleaning={onStartCleaning}
          onCancel={onStop}
        />
      )}

      {cleaningState.phase === "cleaning" && (
        <CleaningPhaseDisplay
          currentWaypointIndex={cleaningState.currentWaypointIndex}
          totalWaypoints={cleaningState.totalWaypoints}
          progressPercent={cleaningState.progressPercent}
          elapsedSeconds={cleaningState.elapsedSeconds}
          onPause={onPause}
          onStop={onStop}
        />
      )}

      {cleaningState.phase === "paused" && (
        <PausedPhaseDisplay
          currentWaypointIndex={cleaningState.currentWaypointIndex}
          totalWaypoints={cleaningState.totalWaypoints}
          elapsedSeconds={cleaningState.elapsedSeconds}
          onResume={onResume}
          onStop={onStop}
        />
      )}

      {cleaningState.phase === "completed" && (
        <CompletedPhaseDisplay
          totalWaypoints={cleaningState.totalWaypoints}
          missedWaypoints={cleaningState.missedWaypoints}
          elapsedSeconds={cleaningState.elapsedSeconds}
          onDone={onDone}
        />
      )}
    </div>
  );
}
