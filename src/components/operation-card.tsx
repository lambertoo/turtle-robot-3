"use client";

import type { RobotMode } from "@/lib/ros-types";

interface OperationCardProps {
  title: string;
  description: string;
  mode: RobotMode;
  activeMode: RobotMode;
  isConnected: boolean;
  onActivate: (mode: RobotMode) => void;
}

const MODE_ICONS: Record<string, string> = {
  slam: "🗺️",
  patrol: "🔄",
  teleop: "🎮",
};

const MODE_COLORS: Record<string, string> = {
  slam: "var(--color-accent-blue)",
  patrol: "var(--color-accent-green)",
  teleop: "var(--color-accent-amber)",
};

export function OperationCard({
  title,
  description,
  mode,
  activeMode,
  isConnected,
  onActivate,
}: OperationCardProps) {
  const isActive = activeMode === mode;
  const isDisabled = !isConnected || (activeMode !== "idle" && !isActive);

  return (
    <button
      onClick={() => onActivate(isActive ? "idle" : mode)}
      disabled={isDisabled}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
        isActive
          ? "border-current bg-[var(--color-surface)]"
          : isDisabled
            ? "cursor-not-allowed border-transparent bg-[var(--color-surface)] opacity-40"
            : "border-transparent bg-[var(--color-surface)] hover:border-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)]"
      }`}
      style={isActive ? { borderColor: MODE_COLORS[mode] } : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{MODE_ICONS[mode]}</span>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
