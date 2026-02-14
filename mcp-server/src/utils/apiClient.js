/**
 * HTTP client factory for VCC Manager API.
 *
 * Creates a bound apiRequest function with the given API key.
 * - HTTP mode: API key comes from client's Bearer token (per-session)
 * - stdio mode: API key comes from VCC_API_KEY environment variable
 */

const API_URL = process.env.VCC_API_URL || 'http://localhost:3000';

/**
 * Create an API request function bound to a specific API key.
 *
 * @param {string} apiKey - VCC Manager API Key
 * @returns {(path: string, options?: object) => Promise<any>}
 */
export function createApiClient(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  return async function apiRequest(path, options = {}) {
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
        'X-API-Key': apiKey,
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
  };
}
