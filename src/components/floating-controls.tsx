"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { RobotMode } from "@/lib/ros-types";

interface FloatingControlsProps {
  activeMode: RobotMode;
  isConnected: boolean;
  onActivateMode: (mode: RobotMode) => void;
  onEmergencyStop: () => void;
}

const AUTO_HIDE_DELAY_MS = 5000;

export function FloatingControls({
  activeMode,
  isConnected,
  onActivateMode,
  onEmergencyStop,
}: FloatingControlsProps) {
  const t = useTranslations("operations");
  const hudT = useTranslations("hud");
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetHideTimer = useCallback(() => {
    setIsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, AUTO_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    resetHideTimer();
    window.addEventListener("mousemove", resetHideTimer);

    return () => {
      window.removeEventListener("mousemove", resetHideTimer);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  const modeButtons: Array<{ mode: RobotMode; label: string; icon: React.ReactNode }> = [
    {
      mode: "slam",
      label: t("slam.title"),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M3 12h1m8-9v1m8 8h1m-9 8v1" />
          <path d="m18.36 5.64-.71.71M6.34 17.66l-.7.7M5.64 5.64l.7.7m11.31 11.31.71.71" />
        </svg>
      ),
    },
    {
      mode: "patrol",
      label: t("patrol.title"),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
          <path d="M12 8v4l3 3" />
        </svg>
      ),
    },
    {
      mode: "teleop",
      label: t("teleop.title"),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300"
      style={{ opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? "auto" : "none" }}
    >
      <div className="hud-panel flex items-center gap-3 rounded-2xl px-5 py-3 backdrop-blur-md">
        {modeButtons.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => onActivateMode(mode)}
            title={label}
            disabled={!isConnected}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeMode === mode
                ? "bg-[var(--color-undp-primary)] text-white shadow-lg shadow-[rgba(4,104,177,0.4)]"
                : "text-[var(--color-text-secondary)] hover:bg-[rgba(4,104,177,0.15)] hover:text-[var(--color-text-primary)]"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}

        <div className="mx-1 h-8 w-px bg-[rgba(4,104,177,0.3)]" />

        <button
          onClick={onEmergencyStop}
          title={hudT("emergency")}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-accent-red)]/20 border border-[var(--color-accent-red)]/50 px-4 py-2 text-sm font-bold text-[var(--color-accent-red)] transition-all hover:bg-[var(--color-accent-red)]/30 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <span className="hidden sm:inline">{hudT("emergency")}</span>
        </button>
      </div>
    </div>
  );
}
