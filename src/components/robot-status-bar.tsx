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

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-6 py-3">
      <div className="flex items-center gap-4">
        <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
        <span className="text-lg font-bold">{t("appName")}</span>
      </div>

      <div className="flex items-center gap-6">
        {showMultiRobotStatus ? (
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                connectedRobotCount! > 0
                  ? "bg-[var(--color-accent-green)]"
                  : "bg-[var(--color-accent-red)]"
              }`}
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {settingsT("connectedCount", {
                connected: connectedRobotCount,
                total: totalRobotCount,
              })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`h-3 w-3 rounded-full ${
                singleConnected
                  ? "bg-[var(--color-accent-green)]"
                  : "bg-[var(--color-accent-red)]"
              }`}
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {singleConnected ? t("connected") : t("disconnected")}
            </span>
          </div>
        )}

        {controlledRobotName && (
          <div className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-primary)]">
              {controlledRobotName}
            </span>
          </div>
        )}

        <div className="text-sm text-[var(--color-text-secondary)]">
          {t("activeMode")}:{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {modeLabels[activeMode]}
          </span>
        </div>

        <button
          onClick={() => router.push(`${localePrefix}/settings`)}
          className="text-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          title={settingsT("title")}
        >
          ⚙
        </button>

        <LanguageToggle />
      </div>
    </header>
  );
}
