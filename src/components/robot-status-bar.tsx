"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import type { RobotMode } from "@/lib/ros-types";
import { LanguageToggle } from "./language-toggle";

interface RobotStatusBarProps {
  isConnected?: boolean;
  activeMode: RobotMode;
  connectedRobotCount?: number;
  totalRobotCount?: number;
  controlledRobotName?: string | null;
}

export function RobotStatusBar({
  isConnected,
  activeMode,
  connectedRobotCount,
  totalRobotCount,
  controlledRobotName,
}: RobotStatusBarProps) {
  const t = useTranslations("common");
  const settingsT = useTranslations("settings");
  const operationsTranslations = useTranslations("operations");
  const hudT = useTranslations("hud");
  const pathname = usePathname();
  const router = useRouter();

  const localePrefix = pathname.split("/").slice(0, 2).join("/");

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
    <header className="relative flex items-center justify-between hud-panel px-6 py-3 border-b border-blue-500/20">
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
          onClick={() => router.push(`${localePrefix}/settings`)}
          className="text-lg text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)] transition-colors"
          title={settingsT("title")}
        >
          ⚙
        </button>

        <LanguageToggle />
      </div>
    </header>
  );
}
