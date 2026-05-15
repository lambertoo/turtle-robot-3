"use client";

import { useTranslations } from "next-intl";
import type { RobotMode } from "@/lib/ros-types";
import { LanguageToggle } from "./language-toggle";
import { DemoModeToggle } from "./demo-mode-toggle";

interface RobotStatusBarProps {
  activeMode: RobotMode;
  connectedRobotCount?: number;
  totalRobotCount?: number;
  controlledRobotName?: string | null;
  batteryVoltage?: number | null;
  batteryPercentage?: number | null;
  headingDegrees?: number | null;
  onOpenSettings?: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

export function RobotStatusBar({
  connectedRobotCount,
  totalRobotCount,
  controlledRobotName,
  batteryVoltage,
  batteryPercentage,
  onOpenSettings,
  isDemoMode = false,
  onToggleDemoMode,
}: RobotStatusBarProps) {
  const t = useTranslations("common");
  const settingsT = useTranslations("settings");
  const hudT = useTranslations("hud");

  const showMultiRobotStatus = totalRobotCount !== undefined && connectedRobotCount !== undefined;
  const isAnyConnected = showMultiRobotStatus ? (connectedRobotCount! > 0) : false;

  return (
    <header className="relative flex items-center justify-between hud-panel px-6 py-3 border-b border-blue-500/20">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--color-madagascar-green)] via-[var(--color-accent-blue)] to-[var(--color-madagascar-green)]" />

      <div className="flex items-center gap-4">
        <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
        <span className="text-lg font-bold tracking-wide text-[var(--color-text-primary)]">
          {t("appName")}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="font-mono-data text-xs text-[var(--color-text-secondary)] tracking-widest uppercase">
            {hudT("system")}
          </span>
          <div
            className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isAnyConnected ? "status-dot-connected animate-pulse-glow" : "status-dot-disconnected"}`}
          />
          <span className="font-mono-data text-sm text-[var(--color-text-secondary)]">
            {showMultiRobotStatus
              ? settingsT("connectedCount", { connected: connectedRobotCount, total: totalRobotCount })
              : (isAnyConnected ? t("connected") : t("disconnected"))}
          </span>
        </div>

        {controlledRobotName && (
          <span className="font-mono-data text-sm font-semibold text-[var(--color-text-primary)]">
            {controlledRobotName}
          </span>
        )}

        {batteryVoltage !== null && batteryVoltage !== undefined && (() => {
          const isLow = batteryVoltage < 11.1;
          const isCritical = batteryVoltage < 10.5;
          const batteryColor = isCritical
            ? "var(--color-accent-red)"
            : isLow
              ? "var(--color-accent-amber)"
              : "var(--color-accent-green)";
          const pct = batteryPercentage ?? 0;
          return (
            <div className={`flex items-center gap-1.5 ${isCritical ? "animate-pulse" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 16" fill="none">
                <rect x="1" y="1" width="18" height="14" rx="2" stroke={batteryColor} strokeWidth="1.5" />
                <rect x="19" y="5" width="3" height="6" rx="1" fill={batteryColor} />
                <rect x="3" y="3" width={`${Math.max(1, Math.min(14, (pct / 100) * 14))}`} height="10" rx="1" fill={batteryColor} opacity="0.8" />
              </svg>
              <span className="font-mono-data text-sm" style={{ color: batteryColor }}>
                {batteryVoltage.toFixed(1)}V
              </span>
              {isLow && (
                <span className={`font-mono-data text-xs font-bold uppercase ${isCritical ? "text-[var(--color-accent-red)] animate-blink" : "text-[var(--color-accent-amber)]"}`}>
                  {isCritical ? "CRIT" : "LOW"}
                </span>
              )}
            </div>
          );
        })()}

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-undp-primary)] px-4 py-2 text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 active:scale-95"
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

        <LanguageToggle />
      </div>
    </header>
  );
}
