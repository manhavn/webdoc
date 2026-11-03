export const AUTOSAVE_INTERVALS = [30, -1, 5, 10, 20];
export const AUTOSAVE_STORAGE_KEY = 'webdoc_docs_autosave_interval';

export function readStoredAutosaveInterval(fallback = 30) {
  try {
    const raw =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)
        : null;
    if (raw !== null && raw !== '') {
      const parsed = parseInt(raw, 10);
      if (AUTOSAVE_INTERVALS.includes(parsed)) {
        return parsed;
      }
    }
  } catch {
    /* ignore storage errors */
  }
  return fallback;
}

export function writeStoredAutosaveInterval(interval) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, String(interval));
    }
  } catch {
    /* ignore storage errors */
  }
}

export function getNextAutosaveInterval(current) {
  const currentIndex = AUTOSAVE_INTERVALS.indexOf(Number(current));
  if (currentIndex === -1) return AUTOSAVE_INTERVALS[0];
  const nextIndex = (currentIndex + 1) % AUTOSAVE_INTERVALS.length;
  return AUTOSAVE_INTERVALS[nextIndex];
}
