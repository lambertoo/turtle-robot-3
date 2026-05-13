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
      className="rounded-md border border-[var(--color-surface-hover)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
    >
      {targetLabel}
    </button>
  );
}
