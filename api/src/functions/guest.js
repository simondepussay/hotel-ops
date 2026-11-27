import { route, need, str, HttpError } from '../lib/http.js';
import { list, merge, insert, get, recentKey } from '../lib/db.js';
import { makeToken, readToken, requireUser } from '../lib/auth.js';
import { loadHotel, roomByCode } from '../lib/model.js';

const KINDS = ['towels', 'cleaning', 'amenities', 'problem', 'other'];
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

// Vérifie que le jeton client correspond au séjour en cours de cette chambre.
async function guestStay(request, code) {
  const p = readToken(request.headers.get('x-guest-token'));
  const { room, hotel } = await roomByCode(code);
  if (!p || p.role !== 'guest' || !room.stayId || p.stayId !== room.stayId || p.roomId !== room.rowKey) {
    throw new HttpError(401, 'stay_expired');
  }
  return { room, hotel, stayId: p.stayId };
}

function publicRequest(r) {
  return {
    id: r.rowKey,
    roomId: r.roomId,
    roomNumber: r.roomNumber,
    kind: r.kind,
    text: r.text,
    lang: r.lang,
    status: r.status,
    at: r.at,
    doneBy: r.doneBy || null,
  };
}

// Le client tape le code séjour donné à l'arrivée.
route('guest-join', ['POST'], 'r/{code}/join', async ({ params, body }) => {
  const { room } = await roomByCode(params.code);
  if (!room.stayId) throw new HttpError(409, 'no_stay');
  if (room.pinLockedUntil && new Date(room.pinLockedUntil) > new Date()) throw new HttpError(429, 'locked');

  if (String(body.pin ?? '') !== room.stayPin) {
    const fails = (room.pinFails || 0) + 1;
    await merge('rooms', {
      partitionKey: room.partitionKey,
      rowKey: room.rowKey,
      pinFails: fails >= MAX_FAILS ? 0 : fails,
      pinLockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : '',
    });
    throw new HttpError(401, 'bad_pin');
  }
  await merge('rooms', { partitionKey: room.partitionKey, rowKey: room.rowKey, pinFails: 0 });
  const token = makeToken({ role: 'guest', roomId: room.rowKey, stayId: room.stayId }, 30);
  return { token };
});

// Demandes du séjour en cours (vue client).
route('guest-requests-list', ['GET'], 'r/{code}/requests', async ({ request, params }) => {
  const { hotel, stayId } = await guestStay(request, params.code);
  const all = await list('requests', hotel.rowKey, { limit: 300 });
  return { requests: all.filter((r) => r.stayId === stayId).map(publicRequest) };
});

route('guest-requests-create', ['POST'], 'r/{code}/requests', async ({ request, params, body }) => {
  const { room, hotel, stayId } = await guestStay(request, params.code);
  const kind = KINDS.includes(body.kind) ? body.kind : 'other';
  const text = str(body.text, 500);
  if (kind === 'other') need(text);
  const req = {
    partitionKey: hotel.rowKey,
    rowKey: recentKey(),
    roomId: room.rowKey,
    roomNumber: room.number,
    stayId,
    kind,
    text,
    lang: str(body.lang, 5),
    status: 'open',
    at: new Date().toISOString(),
  };
  await insert('requests', req);
  return { request: publicRequest(req) };
});

// Côté staff : toutes les demandes de l'hôtel.
route('hotel-requests-list', ['GET'], 'hotels/{hotelId}/requests', async ({ request, params }) => {
  const user = requireUser(request);
  const hotel = await loadHotel(params.hotelId, user);
  const all = await list('requests', hotel.rowKey, { limit: 200 });
  return { requests: all.map(publicRequest) };
});

route('hotel-requests-update', ['PATCH'], 'hotels/{hotelId}/requests/{id}', async ({ request, params, body }) => {
  const user = requireUser(request);
  const hotel = await loadHotel(params.hotelId, user);
  const req = await get('requests', hotel.rowKey, params.id);
  if (!req) throw new HttpError(404, 'not_found');
  const status = body.status === 'done' ? 'done' : 'open';
  await merge('requests', {
    partitionKey: hotel.rowKey,
    rowKey: req.rowKey,
    status,
    doneBy: status === 'done' ? user.name || user.sub : '',
  });
  return { ok: true };
});
