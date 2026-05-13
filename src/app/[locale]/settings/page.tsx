"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import {
  loadRobotConfigs,
  saveRobotConfigs,
  getDefaultRobotConfigs,
  pickNextColor,
  type RobotConfig,
} from "@/lib/robot-storage";

interface RobotFormState {
  name: string;
  ip: string;
  port: string;
  videoPort: string;
}

const EMPTY_FORM: RobotFormState = { name: "", ip: "", port: "9090", videoPort: "8080" };

export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const pathname = usePathname();
  const localePrefix = pathname.split("/").slice(0, 2).join("/");

  const [robotConfigs, setRobotConfigs] = useState<RobotConfig[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRobotId, setEditingRobotId] = useState<string | null>(null);
  const [formState, setFormState] = useState<RobotFormState>(EMPTY_FORM);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadRobotConfigs();
    setRobotConfigs(stored.length > 0 ? stored : getDefaultRobotConfigs());
  }, []);

  function persistConfigs(updated: RobotConfig[]) {
    setRobotConfigs(updated);
    saveRobotConfigs(updated);
  }

  function handleAddRobot() {
    setShowAddForm(true);
    setEditingRobotId(null);
    setFormState(EMPTY_FORM);
  }

  function handleEditRobot(config: RobotConfig) {
    setEditingRobotId(config.id);
    setShowAddForm(false);
    setFormState({ name: config.name, ip: config.ip, port: String(config.port), videoPort: String(config.videoPort ?? 8080) });
  }

  function handleSaveNew() {
    if (!formState.name.trim() || !formState.ip.trim()) return;
    const newConfig: RobotConfig = {
      id: crypto.randomUUID(),
      name: formState.name.trim(),
      ip: formState.ip.trim(),
      port: parseInt(formState.port, 10) || 9090,
      videoPort: parseInt(formState.videoPort, 10) || 8080,
      color: pickNextColor(robotConfigs),
    };
    persistConfigs([...robotConfigs, newConfig]);
    setShowAddForm(false);
    setFormState(EMPTY_FORM);
  }

  function handleSaveEdit(id: string) {
    if (!formState.name.trim() || !formState.ip.trim()) return;
    persistConfigs(
      robotConfigs.map((config) =>
        config.id === id
          ? { ...config, name: formState.name.trim(), ip: formState.ip.trim(), port: parseInt(formState.port, 10) || 9090, videoPort: parseInt(formState.videoPort, 10) || 8080 }
          : config
      )
    );
    setEditingRobotId(null);
    setFormState(EMPTY_FORM);
  }

  function handleCancelEdit() {
    setEditingRobotId(null);
    setShowAddForm(false);
    setFormState(EMPTY_FORM);
  }

  function handleRemoveRobot(id: string) {
    persistConfigs(robotConfigs.filter((config) => config.id !== id));
    setConfirmRemoveId(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between border-b border-[var(--color-surface)] bg-[var(--color-surface)] px-6 py-3">
        <div className="flex items-center gap-4">
          <img src="/unipod-logo.svg" alt="UNIPOD MADAGASCAR" className="h-8" />
          <span className="text-lg font-bold">{t("title")}</span>
        </div>
        <button
          onClick={() => router.push(`${localePrefix}`)}
          className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        >
          ← {t("backToDashboard")}
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {robotConfigs.length === 0 && !showAddForm && (
          <div className="mb-6 rounded-xl bg-[var(--color-surface)] p-8 text-center">
            <p className="mb-2 text-[var(--color-text-secondary)]">{t("noRobots")}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("addFirst")}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {robotConfigs.map((config) => (
            <div key={config.id} className="rounded-xl bg-[var(--color-surface)] p-4">
              {editingRobotId === config.id ? (
                <RobotForm
                  formState={formState}
                  onChange={setFormState}
                  onSave={() => handleSaveEdit(config.id)}
                  onCancel={handleCancelEdit}
                  t={t}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <span
                    className="h-4 w-4 flex-shrink-0 rounded-full border border-white/20"
                    style={{ background: config.color }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{config.name}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {config.ip}:{config.port}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditRobot(config)}
                      className="rounded-lg px-3 py-1 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      {t("editRobot")}
                    </button>
                    {confirmRemoveId === config.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t("removeConfirm")}
                        </span>
                        <button
                          onClick={() => handleRemoveRobot(config.id)}
                          className="rounded-lg px-3 py-1 text-sm text-white transition"
                          style={{ background: "var(--color-accent-red)" }}
                        >
                          {t("removeRobot")}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded-lg px-3 py-1 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(config.id)}
                        className="rounded-lg px-3 py-1 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
                        style={{ color: "var(--color-accent-red)" }}
                      >
                        {t("removeRobot")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {showAddForm && (
          <div className="mt-3 rounded-xl bg-[var(--color-surface)] p-4">
            <RobotForm
              formState={formState}
              onChange={setFormState}
              onSave={handleSaveNew}
              onCancel={handleCancelEdit}
              t={t}
            />
          </div>
        )}

        {!showAddForm && (
          <button
            onClick={handleAddRobot}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-[var(--color-surface)] py-4 text-[var(--color-text-secondary)] transition hover:border-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            + {t("addRobot")}
          </button>
        )}
      </main>
    </div>
  );
}

interface RobotFormProps {
  formState: RobotFormState;
  onChange: (state: RobotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  t: (key: string) => string;
}

function RobotForm({ formState, onChange, onSave, onCancel, t }: RobotFormProps) {
  const inputClass =
    "w-full rounded-lg bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
          {t("robotName")}
        </label>
        <input
          className={inputClass}
          value={formState.name}
          onChange={(e) => onChange({ ...formState, name: e.target.value })}
          placeholder="TurtleBot Alpha"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("robotIp")}
          </label>
          <input
            className={inputClass}
            value={formState.ip}
            onChange={(e) => onChange({ ...formState, ip: e.target.value })}
            placeholder="192.168.1.100"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("robotPort")}
          </label>
          <input
            className={inputClass}
            value={formState.port}
            onChange={(e) => onChange({ ...formState, port: e.target.value })}
            placeholder="9090"
            type="number"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
        >
          {t("cancel")}
        </button>
        <button
          onClick={onSave}
          className="rounded-lg px-4 py-2 text-sm text-white transition hover:brightness-110"
          style={{ background: "var(--color-accent-blue)" }}
        >
          {t("save")}
        </button>
      </div>
    </div>
  );
}
