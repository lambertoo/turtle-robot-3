"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  saveRobotConfigs,
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

export interface RobotConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  robotConfigs: RobotConfig[];
  onConfigsChange: (configs: RobotConfig[]) => void;
}

function connectionStatusDotColor(isConnected: boolean, hasError: boolean): string {
  if (isConnected) return "bg-[var(--color-accent-green)]";
  if (hasError) return "bg-[var(--color-accent-red)]";
  return "bg-[var(--color-text-secondary)]";
}

const INPUT_CLASS =
  "w-full rounded-lg bg-[var(--color-background)] border border-[var(--color-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]";

interface RobotInlineFormProps {
  formState: RobotFormState;
  onChange: (state: RobotFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
  autoFocusRef?: React.RefObject<HTMLInputElement | null>;
}

function RobotInlineForm({ formState, onChange, onSave, onCancel, t, autoFocusRef }: RobotInlineFormProps) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <div>
        <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
          {t("name")}
        </label>
        <input
          ref={autoFocusRef as React.RefObject<HTMLInputElement>}
          className={INPUT_CLASS}
          value={formState.name}
          onChange={(e) => onChange({ ...formState, name: e.target.value })}
          placeholder={t("namePlaceholder")}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("ip")}
          </label>
          <input
            className={INPUT_CLASS}
            value={formState.ip}
            onChange={(e) => onChange({ ...formState, ip: e.target.value })}
            placeholder={t("ipPlaceholder")}
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("port")}
          </label>
          <input
            className={INPUT_CLASS}
            value={formState.port}
            onChange={(e) => onChange({ ...formState, port: e.target.value })}
            placeholder="9090"
            type="number"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {t("videoPort")}
          </label>
          <input
            className={INPUT_CLASS}
            value={formState.videoPort}
            onChange={(e) => onChange({ ...formState, videoPort: e.target.value })}
            placeholder="8080"
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

export function RobotConfigModal({
  isOpen,
  onClose,
  robotConfigs,
  onConfigsChange,
}: RobotConfigModalProps) {
  const t = useTranslations("configModal");

  const [editingRobotId, setEditingRobotId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formState, setFormState] = useState<RobotFormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  function persistConfigs(updated: RobotConfig[]) {
    saveRobotConfigs(updated);
    onConfigsChange(updated);
  }

  function handleAddRobot() {
    setShowAddForm(true);
    setEditingRobotId(null);
    setFormState(EMPTY_FORM);
    setConfirmDeleteId(null);
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

  function handleEditRobot(config: RobotConfig) {
    setEditingRobotId(config.id);
    setShowAddForm(false);
    setFormState({ name: config.name, ip: config.ip, port: String(config.port), videoPort: String(config.videoPort ?? 8080) });
    setConfirmDeleteId(null);
  }

  function handleSaveEdit(id: string) {
    if (!formState.name.trim() || !formState.ip.trim()) return;
    persistConfigs(
      robotConfigs.map((config) =>
        config.id === id
          ? {
              ...config,
              name: formState.name.trim(),
              ip: formState.ip.trim(),
              port: parseInt(formState.port, 10) || 9090,
              videoPort: parseInt(formState.videoPort, 10) || 8080,
            }
          : config
      )
    );
    setEditingRobotId(null);
    setFormState(EMPTY_FORM);
  }

  function handleCancelForm() {
    setEditingRobotId(null);
    setShowAddForm(false);
    setFormState(EMPTY_FORM);
  }

  function handleDeleteRobot(id: string) {
    persistConfigs(robotConfigs.filter((config) => config.id !== id));
    setConfirmDeleteId(null);
  }

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && (showAddForm || editingRobotId)) {
      firstInputRef.current?.focus();
    }
  }, [isOpen, showAddForm, editingRobotId]);

  useEffect(() => {
    if (!isOpen) {
      setEditingRobotId(null);
      setShowAddForm(false);
      setFormState(EMPTY_FORM);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-surface-hover)] px-6 py-4">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">
            {t("title")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            aria-label={t("close")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="2" x2="16" y2="16" />
              <line x1="16" y1="2" x2="2" y2="16" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {robotConfigs.length === 0 && !showAddForm && (
            <div className="mb-4 rounded-xl bg-[var(--color-background)] p-6 text-center">
              <p className="mb-1 text-sm text-[var(--color-text-secondary)]">{t("noRobots")}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("noRobotsHint")}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {robotConfigs.map((config) => (
              <div
                key={config.id}
                className="rounded-xl bg-[var(--color-background)] px-4 py-3"
              >
                {editingRobotId === config.id ? (
                  <RobotInlineForm
                    formState={formState}
                    onChange={setFormState}
                    onSave={() => handleSaveEdit(config.id)}
                    onCancel={handleCancelForm}
                    t={t}
                    autoFocusRef={firstInputRef}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full border border-white/20"
                      style={{ background: config.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {config.name}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {config.ip}:{config.port}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {confirmDeleteId === config.id ? (
                        <>
                          <span className="text-xs text-[var(--color-text-secondary)]">
                            {t("deleteConfirm")}
                          </span>
                          <button
                            onClick={() => handleDeleteRobot(config.id)}
                            className="rounded-lg px-3 py-1 text-xs text-white transition hover:brightness-110"
                            style={{ background: "var(--color-accent-red)" }}
                          >
                            {t("delete")}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg px-3 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
                          >
                            {t("cancel")}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditRobot(config)}
                            className="rounded-lg px-3 py-1 text-xs text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                          >
                            {t("edit")}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(config.id)}
                            className="rounded-lg px-3 py-1 text-xs transition hover:bg-[var(--color-surface-hover)]"
                            style={{ color: "var(--color-accent-red)" }}
                          >
                            {t("delete")}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showAddForm && (
            <div className="mt-3 rounded-xl bg-[var(--color-background)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t("addRobot")}
              </p>
              <RobotInlineForm
                formState={formState}
                onChange={setFormState}
                onSave={handleSaveNew}
                onCancel={handleCancelForm}
                t={t}
                autoFocusRef={firstInputRef}
              />
            </div>
          )}

          {!showAddForm && (
            <button
              onClick={handleAddRobot}
              className="mt-3 w-full rounded-xl border-2 border-dashed border-[var(--color-surface-hover)] py-3 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-blue)] hover:text-[var(--color-text-primary)]"
            >
              {t("addRobot")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
