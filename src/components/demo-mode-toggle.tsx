"use client";

import { useTranslations } from "next-intl";

interface DemoModeToggleProps {
  isDemoMode: boolean;
  onToggle: () => void;
}

export function DemoModeToggle({ isDemoMode, onToggle }: DemoModeToggleProps) {
  const demoT = useTranslations("demo");

  if (isDemoMode) {
    return (
      <button
        onClick={onToggle}
        title={demoT("disable")}
        className="flex items-center gap-1.5 rounded-md bg-amber-500/20 border border-amber-500/60 px-3 py-1 transition-all hover:bg-amber-500/30"
      >
        <span
          className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0"
          style={{ animation: "pulse-glow 1s ease-in-out infinite" }}
        />
        <span className="font-mono-data text-xs font-bold tracking-widest uppercase text-amber-400">
          {demoT("label")}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      title={demoT("enable")}
      className="flex items-center gap-1.5 rounded-md border border-[rgba(4,104,177,0.3)] px-3 py-1 transition-all hover:bg-[rgba(4,104,177,0.1)] hover:border-[rgba(4,104,177,0.5)]"
    >
      <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
        {demoT("label")}
      </span>
    </button>
  );
}
