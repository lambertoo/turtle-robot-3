"use client";

import { useServiceStatus, type ServiceInfo } from "@/hooks/use-service-status";
import { useTranslations } from "next-intl";

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  "turtlebot3-compute": "SLAM & Explorer",
  "turtlebot3-dashboard": "Dashboard",
};

function StatusDot({ status }: { status: ServiceInfo["status"] }) {
  const colorClass = {
    running: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]",
    stopped: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]",
    error: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] animate-pulse",
    unknown: "bg-gray-500",
  }[status];

  return <div className={`h-2 w-2 rounded-full flex-shrink-0 ${colorClass}`} />;
}

export function ServiceStatusPanel() {
  const t = useTranslations("common");
  const { services } = useServiceStatus(5000);

  const allRunning = services.every((s) => s.status === "running");
  const anyError = services.some((s) => s.status === "error" || s.status === "stopped");

  return (
    <div className="cockpit-panel px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono-data text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
          {t("services")}
        </span>
        <StatusDot status={allRunning ? "running" : anyError ? "error" : "unknown"} />
      </div>

      <div className="space-y-1.5">
        {services.map((service) => (
          <div key={service.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StatusDot status={service.status} />
              <span className="font-mono-data text-xs text-[var(--color-text-primary)]">
                {SERVICE_DISPLAY_NAMES[service.name] ?? service.name}
              </span>
            </div>
            {service.uptime && (
              <span className="font-mono-data text-[10px] text-[var(--color-text-secondary)]">
                {service.uptime}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
