/**
 * Helpers for the CMS language table. Older locale documents predate the
 * public-site flags, so they are treated as visible with the CMS default as
 * their website default.
 */
export function resolveUiState(locale) {
  const enabled = locale?.enabled !== false;
  const hasUiEnabled = typeof locale?.uiEnabled === 'boolean';
  const uiEnabled = enabled && (hasUiEnabled ? locale.uiEnabled : true);
  const hasUiDefault = typeof locale?.uiDefault === 'boolean';
  const uiDefault =
    uiEnabled && (hasUiDefault ? locale.uiDefault : Boolean(locale?.isDefault));
  return { uiEnabled, uiDefault };
}

/** Accepts the admin list either as a bare array or wrapped in an object. */
export function normalizeLanguageList(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.locales || payload?.items || [];
  const items = [...list].sort(
    (a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0) ||
      String(a.code).localeCompare(String(b.code)),
  );
  const defaultLocale =
    (payload && !Array.isArray(payload) && payload.defaultLocale) ||
    items.find((item) => item.isDefault)?.code ||
    '';
  return { items, defaultLocale };
}

/** Builds the create/update payload, keeping the website flags consistent. */
export function buildLanguagePayload(form, { ui, admin }) {
  const enabled = Boolean(form.enabled);
  const uiEnabled = enabled && Boolean(form.uiEnabled);
  return {
    name: String(form.name ?? '').trim(),
    enabled,
    isDefault: Boolean(form.isDefault),
    uiEnabled,
    uiDefault: uiEnabled && Boolean(form.uiDefault),
    order: Number(form.order) || 0,
    ui,
    admin,
  };
}

/** Partial update used by the row action that shows/hides a locale. */
export function uiVisibilityPayload(locale) {
  return { uiEnabled: !resolveUiState(locale).uiEnabled };
}

/** Partial update used by the row action that picks the website default. */
export function uiDefaultPayload() {
  return { uiDefault: true };
}

export function countVisibleUiLocales(items) {
  return items.filter((item) => resolveUiState(item).uiEnabled).length;
}

/**
 * Confirms the reset flow: call the endpoint, then refresh the list and the
 * CMS translations before reporting success.
 */
export async function runLanguageReset({ client, loadList, loadI18n, onDone }) {
  await client.resetLanguages();
  await Promise.all([loadList(), loadI18n()]);
  if (onDone) onDone();
}
