export interface SavedMap {
  id: string;
  name: string;
  filePath: string;
  savedAt: string;
}

const STORAGE_KEY = "unipod_saved_maps";

export function loadSavedMaps(): SavedMap[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SavedMap[];
  } catch {
    return [];
  }
}

export function addSavedMap(map: SavedMap): void {
  const maps = loadSavedMaps();
  maps.push(map);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

export function removeSavedMap(mapId: string): void {
  const maps = loadSavedMaps().filter((m) => m.id !== mapId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}
