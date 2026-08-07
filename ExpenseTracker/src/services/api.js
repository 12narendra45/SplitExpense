import { Platform } from 'react-native';

const DEFAULT_HOST = '10.173.126.1';
const DEFAULT_PORT = '5000';

const getBaseUrl = () => {
  const host = process.env.EXPO_PUBLIC_API_HOST || DEFAULT_HOST;
  const port = process.env.EXPO_PUBLIC_API_PORT || DEFAULT_PORT;

  return `http://${host}:${port}/api`;
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
