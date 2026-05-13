"use client";

import { useTranslations } from "next-intl";

export default function OperatorPage() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">{t("appName")}</h1>
    </div>
  );
}
