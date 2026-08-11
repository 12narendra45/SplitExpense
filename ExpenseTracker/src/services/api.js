const DEFAULT_API_URL = 'https://split-expense-henna.vercel.app/api';

const getBaseUrl = () => {
  return process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
};

export const API_BASE_URL = getBaseUrl();

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? options.body : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(body?.message || 'Request failed');
  }

  return body;
}
