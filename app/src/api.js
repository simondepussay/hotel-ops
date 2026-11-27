import { store } from './dom.js';

const TOKEN = 'hotelops.token';
const USER = 'hotelops.user';

export const session = {
  get token() {
    return store(TOKEN);
  },
  get user() {
    try {
      return JSON.parse(store(USER) || 'null');
    } catch {
      return null;
    }
  },
  save({ token, user }) {
    store(TOKEN, token);
    store(USER, JSON.stringify(user));
  },
  clear() {
    store(TOKEN, null);
    store(USER, null);
  },
};

export const guestToken = {
  get: (code) => store('hotelops.guest.' + code),
  set: (code, t) => store('hotelops.guest.' + code, t),
  clear: (code) => store('hotelops.guest.' + code, null),
};

export async function api(path, { method = 'GET', body, guest } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (session.token) headers['x-hotel-token'] = session.token;
  if (guest) headers['x-guest-token'] = guest;
  const res = await fetch('/api/' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.error === 'not_logged_in') session.clear();
    const err = new Error(data.error || 'server_error');
    err.status = res.status;
    err.code = data.error || 'server_error';
    throw err;
  }
  return data;
}
