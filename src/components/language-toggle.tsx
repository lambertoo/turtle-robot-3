"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";

export function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const targetLocale = locale === "fr" ? "en" : "fr";
  const targetLabel = locale === "fr" ? "EN" : "FR";

  function switchLanguage() {
    router.replace(pathname, { locale: targetLocale });
  }

  return (
    <button
      onClick={switchLanguage}
      className="font-mono-data rounded-md border border-[var(--color-surface-hover)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-all hover:border-blue-500/40 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
      style={{
        boxShadow: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 8px rgba(59,130,246,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      {targetLabel}
    </button>
  );
}
