/**
 * HTTP client with API Key authentication for VCC Manager API.
 *
 * Reads VCC_API_URL and VCC_API_KEY from environment variables.
 * All requests include X-API-Key header for authentication.
 */

const API_URL = process.env.VCC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.VCC_API_KEY;

/**
 * Make an authenticated API request.
 */
export async function apiRequest(path, options = {}) {
  if (!API_KEY) {
    throw new Error('VCC_API_KEY environment variable is required');
  }

  const { method = 'GET', body, params, responseType } = options;

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
      'X-API-Key': API_KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url.toString(), fetchOptions);

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
