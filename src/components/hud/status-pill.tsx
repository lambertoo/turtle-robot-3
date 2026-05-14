"use client";

import { useTranslations } from "next-intl";
import type { RobotMode } from "@/lib/ros-types";

interface StatusPillProps {
  activeMode: RobotMode;
  isConnected: boolean;
  robotName: string | null;
  onExitMode: () => void;
}

export function StatusPill({ activeMode, isConnected, robotName, onExitMode }: StatusPillProps) {
  const t = useTranslations("operations");

  const modeLabels: Record<RobotMode, string> = {
    idle: "IDLE",
    slam: t("slam.title"),
    patrol: t("patrol.title"),
    teleop: t("teleop.title"),
    cleaning: t("clean.title"),
  };

  return (
    <div className="cockpit-panel flex items-center gap-3 px-4 py-2">
      <button
        onClick={onExitMode}
        className="flex items-center justify-center rounded p-0.5 text-white/50 transition hover:text-white"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${isConnected ? "status-dot-connected animate-pulse-glow" : "status-dot-disconnected"}`} />

      <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-white">
        {modeLabels[activeMode]}
      </span>

      {robotName && (
        <>
          <div className="h-3 w-px bg-white/20" />
          <span className="font-mono-data text-xs text-white/60">
            {robotName}
          </span>
        </>
      )}
    </div>
  );
}
