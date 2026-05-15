"use client";

import { useTranslations } from "next-intl";

interface EmergencyStopHudProps {
  onStop: () => void;
}

export function EmergencyStopHud({ onStop }: EmergencyStopHudProps) {
  const t = useTranslations("operations.stop");

  return (
    <button
      onClick={onStop}
      className="flex h-14 w-14 items-center justify-center rounded-full text-white transition-all active:scale-90"
      style={{
        background: "linear-gradient(135deg, #dc2626, #991b1b)",
        border: "2px solid rgba(239, 68, 68, 0.5)",
        boxShadow: "0 0 20px rgba(239, 68, 68, 0.4), 0 0 40px rgba(239, 68, 68, 0.15)",
      }}
      title={t("title")}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polygon points="7.86,2 16.14,2 22,7.86 22,16.14 16.14,22 7.86,22 2,16.14 2,7.86" />
        <rect x="8" y="8" width="8" height="8" fill="currentColor" stroke="none" rx="1" />
      </svg>
    </button>
  );
}
