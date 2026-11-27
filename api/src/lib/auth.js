// Mots de passe (scrypt) et jetons signés (HMAC), sans dépendance externe.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { HttpError } from './http.js';

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error('AUTH_SECRET manquant');

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url');

export function makeToken(payload, days = 30) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 }));
  return `${body}.${sign(body)}`;
}

export function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

// Utilisateur staff/director connecté, ou null.
export function currentUser(request) {
  const p = readToken(request.headers.get('x-hotel-token'));
  return p && (p.role === 'staff' || p.role === 'director') ? p : null;
}

export function requireUser(request, role) {
  const u = currentUser(request);
  if (!u) throw new HttpError(401, 'not_logged_in');
  if (role && u.role !== role) throw new HttpError(403, 'forbidden');
  return u;
}

// Le staff n'a accès qu'à son hôtel, le director qu'à ceux qu'il possède.
export function canAccessHotel(user, hotel) {
  if (!user || !hotel) return false;
  if (user.role === 'director') return hotel.ownerId === user.sub;
  return user.hotelId === hotel.rowKey;
}
