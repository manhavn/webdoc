import { translateCurrent } from '../i18n/I18nContext';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');
const TOKEN_KEY = 'webdoc_token';
export const UNAUTHORIZED_EVENT = 'webdoc:unauthorized';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const options = { method, headers: { ...headers } };

  if (token) options.headers.Authorization = `Bearer ${token}`;

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError(translateCurrent('api.networkError'), 0);
  }

  if (response.status === 401 && path !== '/auth/login') {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(translateCurrent('api.sessionExpired'), 401);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && typeof data.error === 'string'
        ? data.error
        : translateCurrent('api.requestFailed', { status: response.status });
    throw new ApiError(message, response.status, data);
  }

  return data;
}


export async function exportBackup() {
  const token = getToken();
  const response = await fetch(`${API_BASE}/admin/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(translateCurrent('api.sessionExpired'), 401);
  }
  if (!response.ok) {
    let message = translateCurrent('api.requestFailed', { status: response.status });
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: await response.blob(),
    filename: match?.[1] || 'webdoc-backup.zip',
  };
}

export const api = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),

  stats: () => request('/admin/stats'),

  listDocs: () => request('/admin/docs'),
  getDoc: (id) => request(`/admin/docs/${id}`),
  createDoc: (payload) => request('/admin/docs', { method: 'POST', body: payload }),
  updateDoc: (id, payload) => request(`/admin/docs/${id}`, { method: 'PUT', body: payload }),
  deleteDoc: (id) => request(`/admin/docs/${id}`, { method: 'DELETE' }),

  getSite: () => request('/admin/site'),
  updateSite: (payload) =>
    request('/admin/site', { method: 'PUT', body: payload }),

  getAppearance: () => request('/admin/appearance'),
  resetHomepage: () =>
    request('/admin/appearance/homepage/reset', { method: 'POST' }),
  updateAppearance: (payload) =>
    request('/admin/appearance', { method: 'PUT', body: payload }),

  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/admin/upload', { method: 'POST', body: form });
  },

  importBackup: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/admin/import', { method: 'POST', body: form });
  },

  changePassword: (currentPassword, newPassword) =>
    request('/admin/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  getI18n: () => request('/i18n'),
  getI18nLocale: (code) => request(`/i18n/${encodeURIComponent(code)}`),

  listLanguages: () => request('/admin/i18n'),
  createLanguage: (payload) =>
    request('/admin/i18n', { method: 'POST', body: payload }),
  resetLanguages: () => request('/admin/i18n/reset', { method: 'POST' }),
  updateLanguage: (code, payload) =>
    request(`/admin/i18n/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: payload,
    }),
  deleteLanguage: (code) =>
    request(`/admin/i18n/${encodeURIComponent(code)}`, { method: 'DELETE' }),
};
