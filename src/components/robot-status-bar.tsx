"use client";

import { useTranslations } from "next-intl";
import type { RobotMode } from "@/lib/ros-types";
import { LanguageToggle } from "./language-toggle";

interface RobotStatusBarProps {
  isConnected: boolean;
  activeMode: RobotMode;
}

export function RobotStatusBar({ isConnected, activeMode }: RobotStatusBarProps) {
  const t = useTranslations("common");
  const operationsTranslations = useTranslations("operations");

  const modeLabels: Record<RobotMode, string> = {
    idle: t("idle"),
    slam: operationsTranslations("slam.title"),
    patrol: operationsTranslations("patrol.title"),
    teleop: operationsTranslations("teleop.title"),
  };

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-6 py-3">
      <div className="flex items-center gap-4">
        <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
        <span className="text-lg font-bold">{t("appName")}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected
                ? "bg-[var(--color-accent-green)]"
                : "bg-[var(--color-accent-red)]"
            }`}
          />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {isConnected ? t("connected") : t("disconnected")}
          </span>
        </div>

        <div className="text-sm text-[var(--color-text-secondary)]">
          {t("activeMode")}:{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {modeLabels[activeMode]}
          </span>
        </div>

        <LanguageToggle />
      </div>
    </header>
  );
}
