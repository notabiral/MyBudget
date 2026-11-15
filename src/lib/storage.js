// Persistence. One localStorage key for v1 state; the legacy key is only
// ever read (for the one-time migration) and never written.
//
// loadInitial() outcomes:
// - "loaded":    v1 state existed; returned normalised.
// - "migrated":  no v1 state, legacy data found and migrated. The legacy
//                key is left untouched as a backup.
// - "fresh":     neither key held usable data; blank state.
// - "recovered": v1 JSON was corrupt; blank state returned and the corrupt
//                value preserved under a ".corrupt" key for inspection.

import { LEGACY_STORAGE_KEY, STORAGE_KEY, blankState, normalizeState } from "./model.js";
import { migrateLegacy } from "./migrate.js";

function getStorage(overrides) {
  if (overrides) return overrides;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

export function loadInitial(storageOverride) {
  const storage = getStorage(storageOverride);
  if (!storage) {
    return { state: blankState(), status: "fresh", report: null };
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { state: normalizeState(parsed), status: "loaded", report: null };
    } catch {
      try {
        storage.setItem(`${STORAGE_KEY}.corrupt`, raw);
      } catch {
        // Storage may be full or unavailable; the corrupt value is
        // already in the original key, so nothing is lost by skipping.
      }
      return { state: blankState(), status: "recovered", report: null };
    }
  }

  const legacyRaw = storage.getItem(LEGACY_STORAGE_KEY);
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw);
      const { state, report } = migrateLegacy(parsed);
      if (report.hadData) {
        return { state, status: "migrated", report };
      }
    } catch {
      // Unparseable legacy data: fall through to a fresh state. The
      // legacy key is left alone either way.
    }
  }

  return { state: blankState(), status: "fresh", report: null };
}

export function saveState(state, storageOverride) {
  const storage = getStorage(storageOverride);
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportStateJSON(state) {
  return JSON.stringify(state, null, 2);
}

/** Trigger a browser download of a text file. No-op outside a browser. */
export function downloadTextFile(filename, text, mime = "text/plain") {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
