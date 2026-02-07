/**
 * HTTP client with JWT auto-authentication for VCC Manager API.
 *
 * Reads VCC_API_URL, VCC_EMAIL, VCC_PASSWORD from environment variables.
 * Auto-signs in on first request and caches the JWT token.
 * Retries once on 401 (token expired).
 */

const API_URL = process.env.VCC_API_URL || 'http://localhost:3000';
const EMAIL = process.env.VCC_EMAIL;
const PASSWORD = process.env.VCC_PASSWORD;

let cachedToken = null;

async function signIn() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('VCC_EMAIL and VCC_PASSWORD environment variables are required');
  }

  const res = await fetch(`${API_URL}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Sign-in failed (${res.status}): ${body.message || res.statusText}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  return cachedToken;
}

async function getToken() {
  if (!cachedToken) {
    await signIn();
  }
  return cachedToken;
}

/**
 * Make an authenticated API request.
 * Automatically handles sign-in and token refresh on 401.
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, params, responseType } = options;

  const token = await getToken();
  const url = new URL(`${API_URL}/api${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const fetchOptions = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(url.toString(), fetchOptions);

  // Retry once on 401 (token expired)
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await signIn();
    fetchOptions.headers['Authorization'] = `Bearer ${newToken}`;
    res = await fetch(url.toString(), fetchOptions);
  }

  if (responseType === 'buffer') {
    if (!res.ok) {
      throw new Error(`API request failed (${res.status}): ${res.statusText}`);
    }
    return {
      buffer: Buffer.from(await res.arrayBuffer()),
      headers: res.headers,
    };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`API request failed (${res.status}): ${data.message || res.statusText}`);
  }

  return data;
}
