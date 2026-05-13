"use client";

import { useTranslations } from "next-intl";

interface FullscreenToggleProps {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function FullscreenToggle({ isFullscreen, onToggle }: FullscreenToggleProps) {
  const fullscreenT = useTranslations("fullscreen");

  return (
    <button
      onClick={onToggle}
      title={isFullscreen ? fullscreenT("exit") : fullscreenT("enter")}
      className="flex items-center justify-center rounded-lg border border-[rgba(4,104,177,0.3)] p-2 transition-all hover:bg-[rgba(4,104,177,0.15)] hover:border-[rgba(4,104,177,0.5)] active:scale-95"
    >
      {isFullscreen ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        </svg>
      )}
    </button>
  );
}
