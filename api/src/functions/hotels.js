import { route, need, str, HttpError } from '../lib/http.js';
import { get, put, merge, insert, list, remove, newId } from '../lib/db.js';
import { requireUser, hashPassword } from '../lib/auth.js';
import { loadHotel, publicHotel, publicRoom } from '../lib/model.js';
import { USERNAME } from './auth.js';

// Liste des hôtels visibles : ceux du director, ou l'hôtel du staff.
route('hotels-list', ['GET'], 'hotels', async ({ request }) => {
  const user = requireUser(request);
  if (user.role === 'staff') {
    const h = await get('hotels', 'hotel', user.hotelId);
    return { hotels: h ? [publicHotel(h)] : [] };
  }
  const all = await list('hotels', 'hotel');
  return { hotels: all.filter((h) => h.ownerId === user.sub).map(publicHotel) };
});

route('hotels-create', ['POST'], 'hotels', async ({ request, body }) => {
  const user = requireUser(request, 'director');
  const hotel = {
    partitionKey: 'hotel',
    rowKey: newId('h'),
    name: str(need(body.name), 80),
    ownerId: user.sub,
    timingMode: false,
    createdAt: new Date().toISOString(),
  };
  await put('hotels', hotel);
  return { hotel: publicHotel(hotel) };
});

// Détail d'un hôtel avec ses chambres (et son équipe pour le director).
route('hotels-get', ['GET'], 'hotels/{hotelId}', async ({ request, params }) => {
  const user = requireUser(request);
  const hotel = await loadHotel(params.hotelId, user);
  const rooms = (await list('rooms', hotel.rowKey)).map(publicRoom);
  rooms.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  let staff;
  if (user.role === 'director') {
    const users = await list('users', 'user');
    staff = users
      .filter((u) => u.hotelId === hotel.rowKey && u.role === 'staff')
      .map((u) => ({ username: u.rowKey, name: u.name, disabled: !!u.disabled }));
  }
  return { hotel: publicHotel(hotel), rooms, staff };
});

route('hotels-update', ['PATCH'], 'hotels/{hotelId}', async ({ request, params, body }) => {
  const user = requireUser(request, 'director');
  const hotel = await loadHotel(params.hotelId, user);
  const patch = { partitionKey: 'hotel', rowKey: hotel.rowKey };
  if (body.name !== undefined) patch.name = str(body.name, 80);
  if (body.timingMode !== undefined) patch.timingMode = !!body.timingMode;
  if (body.plan !== undefined) {
    const json = JSON.stringify(body.plan);
    if (json.length > 30000) throw new HttpError(413, 'plan_too_big');
    patch.plan = json;
  }
  await merge('hotels', patch);
  return { hotel: publicHotel({ ...hotel, ...patch }) };
});

// Le director crée les comptes staff (identifiant + mot de passe, sans e-mail).
route('staff-create', ['POST'], 'hotels/{hotelId}/staff', async ({ request, params, body }) => {
  const user = requireUser(request, 'director');
  const hotel = await loadHotel(params.hotelId, user);
  const username = str(body.username, 32).toLowerCase();
  const password = String(body.password ?? '');
  if (!USERNAME.test(username)) throw new HttpError(400, 'bad_username');
  if (password.length < 6) throw new HttpError(400, 'weak_password');
  try {
    await insert('users', {
      partitionKey: 'user',
      rowKey: username,
      name: str(body.name, 60) || username,
      role: 'staff',
      hotelId: hotel.rowKey,
      hash: hashPassword(password),
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e.statusCode === 409) throw new HttpError(409, 'username_taken');
    throw e;
  }
  return { ok: true };
});

route('staff-delete', ['DELETE'], 'hotels/{hotelId}/staff/{username}', async ({ request, params }) => {
  const user = requireUser(request, 'director');
  const hotel = await loadHotel(params.hotelId, user);
  const target = await get('users', 'user', params.username);
  if (!target || target.role !== 'staff' || target.hotelId !== hotel.rowKey) throw new HttpError(404, 'not_found');
  await remove('users', 'user', target.rowKey);
  return { ok: true };
});
