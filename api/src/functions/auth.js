import { route, need, str, HttpError } from '../lib/http.js';
import { get, insert } from '../lib/db.js';
import { hashPassword, checkPassword, makeToken, requireUser } from '../lib/auth.js';

const USERNAME = /^[a-z0-9._-]{3,32}$/;

function publicUser(u) {
  return { username: u.rowKey, name: u.name, role: u.role, hotelId: u.hotelId || null };
}

function tokenFor(u) {
  return makeToken({ sub: u.rowKey, role: u.role, hotelId: u.hotelId || null, name: u.name });
}

// Inscription : uniquement pour les directors. Le staff est créé par le director.
route('register', ['POST'], 'auth/register', async ({ body }) => {
  const username = str(body.username, 32).toLowerCase();
  const password = String(body.password ?? '');
  if (!USERNAME.test(username)) throw new HttpError(400, 'bad_username');
  if (password.length < 8) throw new HttpError(400, 'weak_password');
  const user = {
    partitionKey: 'user',
    rowKey: username,
    name: str(body.name, 60) || username,
    role: 'director',
    hash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  try {
    await insert('users', user);
  } catch (e) {
    if (e.statusCode === 409) throw new HttpError(409, 'username_taken');
    throw e;
  }
  return { token: tokenFor(user), user: publicUser(user) };
});

route('login', ['POST'], 'auth/login', async ({ body }) => {
  const username = str(need(body.username), 32).toLowerCase();
  const user = await get('users', 'user', username);
  if (!user || user.disabled || !checkPassword(String(body.password ?? ''), user.hash)) {
    throw new HttpError(401, 'bad_credentials');
  }
  return { token: tokenFor(user), user: publicUser(user) };
});

route('me', ['GET'], 'auth/me', async ({ request }) => {
  const u = requireUser(request);
  const user = await get('users', 'user', u.sub);
  if (!user || user.disabled) throw new HttpError(401, 'not_logged_in');
  return { user: publicUser(user) };
});

export { USERNAME, publicUser };
