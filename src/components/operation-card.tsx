"use client";

import React from "react";
import type { RobotMode } from "@/lib/ros-types";

interface OperationCardProps {
  title: string;
  description: string;
  mode: RobotMode;
  activeMode: RobotMode;
  isConnected: boolean;
  onActivate: (mode: RobotMode) => void;
}

function SlamIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="12" x2="19" y2="5" strokeWidth="2" />
      <path d="M12 3 A9 9 0 0 1 21 12" strokeDasharray="3 2" />
    </svg>
  );
}

function PatrolIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="5" r="2" fill="currentColor" />
      <circle cx="19" cy="8" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
      <polyline points="5,5 19,8 12,19 5,5" strokeDasharray="3 2" />
    </svg>
  );
}

function TeleopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="18" height="12" rx="3" />
      <circle cx="8" cy="13" r="2" />
      <line x1="16" y1="11" x2="16" y2="15" />
      <line x1="14" y1="13" x2="18" y2="13" />
    </svg>
  );
}

const MODE_ICONS: Record<string, () => React.ReactElement> = {
  slam: SlamIcon,
  patrol: PatrolIcon,
  teleop: TeleopIcon,
};

const MODE_COLORS: Record<string, string> = {
  slam: "var(--color-accent-blue)",
  patrol: "var(--color-accent-green)",
  teleop: "var(--color-accent-amber)",
};

const MODE_LABELS: Record<string, string> = {
  slam: "SLAM",
  patrol: "NAV",
  teleop: "CTRL",
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
  const IconComponent = MODE_ICONS[mode];

  return (
    <button
      onClick={() => onActivate(isActive ? "idle" : mode)}
      disabled={isDisabled}
      className={`w-full rounded-xl p-4 text-left transition-all hud-panel ${
        isActive
          ? "hud-panel-active"
          : isDisabled
            ? "cursor-not-allowed opacity-40"
            : "hover:border-blue-500/30 hover:shadow-blue-500/10"
      }`}
    >
      <div className="mb-1">
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {MODE_LABELS[mode]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex-shrink-0"
          style={{ color: isActive ? MODE_COLORS[mode] : "var(--color-text-secondary)" }}
        >
          <IconComponent />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[var(--color-text-primary)]">{title}</h3>
            {isActive && (
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: MODE_COLORS[mode],
                  boxShadow: `0 0 6px ${MODE_COLORS[mode]}`,
                }}
              />
            )}
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] truncate">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
