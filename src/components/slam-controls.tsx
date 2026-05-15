"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { SlamState, ExploreMode } from "@/hooks/use-slam";
import { loadSavedMaps, removeSavedMap, type SavedMap } from "@/lib/map-storage";

interface ExplorerStatus {
  state: string;
  lidar_front: number;
  camera_left: boolean;
  camera_center: boolean;
  camera_right: boolean;
}

interface SlamControlsProps {
  slamState: SlamState;
  explorerStatus: ExplorerStatus | null;
  onSelectNewMap: (mode: ExploreMode) => void;
  onStartMapping: () => void;
  onSelectSavedMaps: () => void;
  onBack: () => void;
  onSaveMap: (name: string) => void;
  onLoadMap: (filePath: string) => void;
  onStopExploring: () => void;
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function ChoosePhase({
  onSelectNewMap,
  onSelectSavedMaps,
}: {
  onSelectNewMap: (mode: ExploreMode) => void;
  onSelectSavedMaps: () => void;
}) {
  const t = useTranslations("slam");

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
        {t("title")}
      </span>

      <button
        onClick={() => onSelectNewMap("autonomous")}
        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(4,104,177,0.2), rgba(4,104,177,0.05))",
          border: "1px solid rgba(4,104,177,0.3)",
        }}
      >
        <span className="text-[var(--color-accent-blue)]"><MapIcon /></span>
        <div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">{t("newMapAuto")}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("newMapAutoDescription")}</p>
        </div>
      </button>

      <button
        onClick={() => onSelectNewMap("manual")}
        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.05))",
          border: "1px solid rgba(34,197,94,0.3)",
        }}
      >
        <span className="text-[var(--color-accent-green)]"><MapIcon /></span>
        <div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">{t("newMapManual")}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("newMapManualDescription")}</p>
        </div>
      </button>

      <button
        onClick={onSelectSavedMaps}
        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:brightness-110 active:scale-[0.98]"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))",
          border: "1px solid rgba(245,158,11,0.3)",
        }}
      >
        <span className="text-[var(--color-accent-amber)]"><FolderIcon /></span>
        <div>
          <p className="text-sm font-bold text-[var(--color-text-primary)]">{t("savedMaps")}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("savedMapsDescription")}</p>
        </div>
      </button>
    </div>
  );
}

function NewMapPhase({
  slamState,
  explorerStatus,
  onStartMapping,
  onSaveMap,
  onStopExploring,
  onBack,
}: {
  slamState: SlamState;
  explorerStatus: ExplorerStatus | null;
  onStartMapping: () => void;
  onSaveMap: (name: string) => void;
  onStopExploring: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("slam");
  const [mapName, setMapName] = useState("");

  const handleSave = () => {
    const trimmed = mapName.trim();
    if (trimmed.length === 0) return;
    onSaveMap(trimmed);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded p-1 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {slamState.exploreMode === "autonomous" ? t("newMapAuto") : t("newMapManual")}
        </span>
      </div>

      {!slamState.isMappingStarted && (
        <div className="flex flex-col gap-3 items-center py-4">
          <p className="text-xs text-[var(--color-text-secondary)] text-center">
            {slamState.exploreMode === "autonomous" ? t("readyAutoDescription") : t("readyManualDescription")}
          </p>
          <button
            onClick={onStartMapping}
            className="w-full rounded-xl bg-[var(--color-accent-blue)] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:brightness-110 active:scale-95"
            style={{ boxShadow: "0 0 15px rgba(4,104,177,0.3)" }}
          >
            {t("startMapping")}
          </button>
        </div>
      )}

      {slamState.isMappingStarted && (
        <div className="flex items-center gap-2 rounded-lg bg-[rgba(4,104,177,0.1)] px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
          <span className="font-mono-data text-xs text-[var(--color-accent-green)]">
            {t("mappingActive")}
          </span>
        </div>
      )}

      {slamState.isMappingStarted && slamState.exploreMode === "autonomous" && slamState.isExploring && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[var(--color-text-secondary)]">{t("autoExploreHint")}</p>

          {explorerStatus && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-[rgba(4,104,177,0.08)] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${explorerStatus.state === "exploring" ? "bg-[var(--color-accent-green)]" : explorerStatus.state === "backing_up" ? "bg-[var(--color-accent-amber)]" : "bg-[var(--color-text-secondary)]"}`} />
                <span className="font-mono-data text-xs text-[var(--color-text-secondary)]">
                  {explorerStatus.state === "backing_up" ? "RECOVERING" : explorerStatus.state.toUpperCase()}
                </span>
                <span className="font-mono-data text-xs text-[var(--color-accent-blue)]">
                  {explorerStatus.lidar_front.toFixed(2)}m
                </span>
              </div>
              <div className="flex gap-1">
                <div className={`flex-1 h-1 rounded-full ${explorerStatus.camera_left || explorerStatus.lidar_front <= 0.3 ? "bg-[var(--color-accent-red)]/60" : "bg-[var(--color-accent-green)]/40"}`} />
                <div className={`flex-1 h-1 rounded-full ${explorerStatus.camera_center ? "bg-[var(--color-accent-red)]/60" : "bg-[var(--color-accent-green)]/40"}`} />
                <div className={`flex-1 h-1 rounded-full ${explorerStatus.camera_right || explorerStatus.lidar_front <= 0.3 ? "bg-[var(--color-accent-red)]/60" : "bg-[var(--color-accent-green)]/40"}`} />
              </div>
            </div>
          )}

          <button
            onClick={onStopExploring}
            className="rounded-lg border border-[var(--color-accent-red)]/30 bg-[rgba(228,0,43,0.1)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-accent-red)] transition hover:bg-[rgba(228,0,43,0.2)] active:scale-95"
          >
            {t("stopExplore")}
          </button>
        </div>
      )}

      {slamState.isMappingStarted && slamState.exploreMode === "manual" && (
        <p className="text-xs text-[var(--color-text-secondary)]">{t("manualHint")}</p>
      )}

      <div className="border-t border-[rgba(4,104,177,0.2)] pt-3">
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {t("saveMap")}
        </span>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder={t("mapNamePlaceholder")}
            className="flex-1 rounded-lg bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/50 outline-none border border-[rgba(4,104,177,0.2)] focus:border-[var(--color-accent-blue)]"
          />
          <button
            onClick={handleSave}
            disabled={mapName.trim().length === 0 || slamState.isSaving}
            className="rounded-lg bg-[var(--color-accent-blue)] px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {slamState.isSaving ? "..." : t("save")}
          </button>
        </div>
        {slamState.saveError && (
          <p className="mt-1 text-xs text-[var(--color-accent-red)]">{slamState.saveError}</p>
        )}
      </div>
    </div>
  );
}

function SavedMapsPhase({
  onLoadMap,
  onBack,
}: {
  onLoadMap: (filePath: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations("slam");
  const [maps, setMaps] = useState<SavedMap[]>(() => loadSavedMaps());

  const handleDelete = (mapId: string) => {
    removeSavedMap(mapId);
    setMaps(loadSavedMaps());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="rounded p-1 text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="font-mono-data text-xs tracking-widest uppercase text-[var(--color-text-secondary)]">
          {t("savedMaps")}
        </span>
      </div>

      {maps.length === 0 ? (
        <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">{t("noSavedMaps")}</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
          {maps.map((savedMap) => (
            <div
              key={savedMap.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--color-surface-hover)]"
              style={{ border: "1px solid rgba(4,104,177,0.15)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">{savedMap.name}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {new Date(savedMap.savedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => onLoadMap(savedMap.filePath)}
                  className="rounded px-2 py-1 text-xs font-bold text-[var(--color-accent-blue)] transition hover:bg-[rgba(4,104,177,0.1)]"
                >
                  {t("load")}
                </button>
                <button
                  onClick={() => handleDelete(savedMap.id)}
                  className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-red)] transition"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="11" y2="11" />
                    <line x1="11" y1="1" x2="1" y2="11" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SlamControls({
  slamState,
  explorerStatus,
  onSelectNewMap,
  onStartMapping,
  onSelectSavedMaps,
  onBack,
  onSaveMap,
  onLoadMap,
  onStopExploring,
}: SlamControlsProps) {
  return (
    <div className="cockpit-panel flex flex-col gap-3 p-4" style={{ width: 280 }}>
      {slamState.phase === "choose" && (
        <ChoosePhase onSelectNewMap={onSelectNewMap} onSelectSavedMaps={onSelectSavedMaps} />
      )}
      {slamState.phase === "new-map" && (
        <NewMapPhase
          slamState={slamState}
          explorerStatus={explorerStatus}
          onStartMapping={onStartMapping}
          onSaveMap={onSaveMap}
          onStopExploring={onStopExploring}
          onBack={onBack}
        />
      )}
      {slamState.phase === "saved-maps" && (
        <SavedMapsPhase onLoadMap={onLoadMap} onBack={onBack} />
      )}
    </div>
  );
}
