"use client";

import { useTranslations } from "next-intl";
import type { RobotMode } from "@/lib/ros-types";
import { LanguageToggle } from "./language-toggle";
import { DemoModeToggle } from "./demo-mode-toggle";
import { FullscreenToggle } from "./fullscreen-toggle";

interface RobotStatusBarProps {
  isConnected?: boolean;
  activeMode: RobotMode;
  connectedRobotCount?: number;
  totalRobotCount?: number;
  controlledRobotName?: string | null;
  onOpenSettings?: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function RobotStatusBar({
  isConnected,
  activeMode,
  connectedRobotCount,
  totalRobotCount,
  controlledRobotName,
  onOpenSettings,
  isDemoMode = false,
  onToggleDemoMode,
  isFullscreen = false,
  onToggleFullscreen,
}: RobotStatusBarProps) {
  const t = useTranslations("common");
  const settingsT = useTranslations("settings");
  const operationsTranslations = useTranslations("operations");
  const hudT = useTranslations("hud");

  const modeLabels: Record<RobotMode, string> = {
    idle: t("idle"),
    slam: operationsTranslations("slam.title"),
    patrol: operationsTranslations("patrol.title"),
    teleop: operationsTranslations("teleop.title"),
  };

  const showMultiRobotStatus = totalRobotCount !== undefined && connectedRobotCount !== undefined;
  const singleConnected = !showMultiRobotStatus && isConnected;
  const isAnyConnected = showMultiRobotStatus ? (connectedRobotCount! > 0) : singleConnected;

  return (
    <header className={`relative flex items-center justify-between hud-panel px-6 border-b border-blue-500/20 ${isFullscreen ? "py-2" : "py-3"}`}>
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--color-madagascar-green)] via-[var(--color-accent-blue)] to-[var(--color-madagascar-green)]" />

      <div className="flex items-center gap-4">
        <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
        <span className="text-lg font-bold tracking-wide text-[var(--color-text-primary)]">
          {t("appName")}
        </span>
      </div>

      <div className="flex items-center gap-6">
        {showMultiRobotStatus ? (
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-xs text-[var(--color-text-secondary)] tracking-widest uppercase">
              {hudT("system")}
            </span>
            <div
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isAnyConnected ? "status-dot-connected animate-pulse-glow" : "status-dot-disconnected"}`}
            />
            <span className="font-mono-data text-sm text-[var(--color-text-secondary)]">
              {settingsT("connectedCount", {
                connected: connectedRobotCount,
                total: totalRobotCount,
              })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono-data text-xs text-[var(--color-text-secondary)] tracking-widest uppercase">
              {hudT("system")}
            </span>
            <div
              className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isAnyConnected ? "status-dot-connected animate-pulse-glow" : "status-dot-disconnected"}`}
            />
            <span className="font-mono-data text-sm text-[var(--color-text-secondary)]">
              {isAnyConnected ? t("connected") : t("disconnected")}
            </span>
          </div>
        )}

        {controlledRobotName && (
          <div className="font-mono-data text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {controlledRobotName}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="font-mono-data text-xs text-[var(--color-text-secondary)] tracking-widest uppercase">
            {hudT("mode")}
          </span>
          <span className="font-mono-data text-sm font-semibold text-[var(--color-text-primary)]">
            {modeLabels[activeMode]}
          </span>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-undp-primary)] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 hover:shadow-lg hover:shadow-[rgba(4,104,177,0.3)] active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          {settingsT("title")}
        </button>

        {onToggleDemoMode && (
          <DemoModeToggle isDemoMode={isDemoMode} onToggle={onToggleDemoMode} />
        )}

        {onToggleFullscreen && (
          <FullscreenToggle isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
        )}

        <LanguageToggle />
      </div>
    </header>
  );
}
