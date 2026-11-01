const API_BASE = import.meta.env.VITE_API_BASE || '';

export const apiUrl = (path) => `${API_BASE}${path}`;

export async function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
  });
}
