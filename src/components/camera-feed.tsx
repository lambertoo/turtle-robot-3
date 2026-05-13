"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { RobotConfig } from "@/lib/robot-storage";

export interface CameraFeedProps {
  robotConfig: RobotConfig | null;
  isConnected: boolean;
}

function buildStreamUrl(config: RobotConfig): string {
  return `http://${config.ip}:${config.videoPort}/stream?topic=/camera/image_raw&type=mjpeg`;
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

export function CameraFeed({ robotConfig, isConnected }: CameraFeedProps) {
  const t = useTranslations("camera");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleStreamError = useCallback(() => {
    setStreamError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setStreamError(false);
    setRetryKey((k) => k + 1);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((c) => !c);
  }, []);

  if (!isVisible) return null;

  const showStream = isConnected && robotConfig !== null && !streamError;
  const showOffline = isConnected && robotConfig !== null && streamError;
  const showNoFeed = !isConnected || robotConfig === null;

  return (
    <div
      className="hud-panel absolute bottom-4 right-4 z-20 flex flex-col overflow-hidden rounded-xl"
      style={{
        width: 320,
        border: "1px solid rgba(4, 104, 177, 0.5)",
        boxShadow: "0 0 20px rgba(4, 104, 177, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(4,104,177,0.3)]">
        <span className="text-[var(--color-accent-blue)]">
          <CameraIcon />
        </span>
        <span className="flex-1 truncate font-mono-data text-xs text-[var(--color-text-primary)]">
          {robotConfig?.name ?? t("title")}
        </span>
        <button
          onClick={toggleCollapse}
          className="rounded p-1 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          title={isCollapsed ? t("expand") : t("minimize")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {isCollapsed ? (
              <path d="M2 4l4 4 4-4" />
            ) : (
              <path d="M2 8l4-4 4 4" />
            )}
          </svg>
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="rounded p-1 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="11" y2="11" />
            <line x1="11" y1="1" x2="1" y2="11" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="relative bg-[var(--color-background)]" style={{ height: 200 }}>
          {showStream && (
            <img
              key={retryKey}
              src={buildStreamUrl(robotConfig)}
              alt={t("title")}
              onError={handleStreamError}
              className="h-full w-full object-cover"
            />
          )}

          {showOffline && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <span className="font-mono-data text-xs text-[var(--color-accent-red)]">
                {t("offline")}
              </span>
              <button
                onClick={handleRetry}
                className="rounded-lg px-3 py-1 text-xs text-white transition hover:brightness-110"
                style={{ background: "var(--color-accent-blue)" }}
              >
                {t("retry")}
              </button>
            </div>
          )}

          {showNoFeed && (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono-data text-xs text-[var(--color-text-secondary)]">
                {t("noFeed")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
