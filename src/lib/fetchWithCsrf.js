
/**
 * A wrapper around native fetch that handles httpOnly cookie auth + CSRF.
 * Automatically injects the CSRF token from cookies for mutating requests.
 */
export async function fetchWithCsrf(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  if (typeof document !== 'undefined' && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('itm_csrf='))
      ?.split('=')[1];

    if (csrfToken && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = decodeURIComponent(csrfToken);
    }
  }

  const config = {
    ...options,
    headers,
    credentials: 'include',
  };

  return fetch(url, config);
}
