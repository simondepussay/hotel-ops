import { randomInt } from 'node:crypto';
import { route, need, str, HttpError } from '../lib/http.js';
import { get, merge, insert, list, remove, newId, recentKey } from '../lib/db.js';
import { requireUser, currentUser, canAccessHotel } from '../lib/auth.js';
import { loadHotel, publicHotel, publicRoom, roomByCode } from '../lib/model.js';
import { publish, hotelGroup, stayGroup } from '../lib/realtime.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
const STATUSES = ['todo', 'cleaning', 'done'];
const COMMENT_CATEGORIES = ['cleaning', 'consumption', 'room'];
const DIFFICULTIES = ['easy', 'normal', 'hard'];

function makeCode() {
  let c = '';
  for (let i = 0; i < 8; i++) c += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return c;
}

async function addEvent(room, user, data) {
  const ev = {
    partitionKey: room.rowKey,
    rowKey: recentKey(),
    at: new Date().toISOString(),
    by: user?.sub || null,
    byName: user?.name || null,
    ...data,
  };
  await insert('events', ev);
  return ev;
}

function publicEvent(e) {
  const { partitionKey, rowKey, ...rest } = e;
  return { id: rowKey, ...rest };
}

// Création de chambres en série (ex : 101 à 120).
route('rooms-create', ['POST'], 'hotels/{hotelId}/rooms', async ({ request, params, body }) => {
  const user = requireUser(request, 'director');
  const hotel = await loadHotel(params.hotelId, user);
  const numbers = [...new Set((Array.isArray(body.numbers) ? body.numbers : []).map((n) => str(n, 10)).filter(Boolean))];
  if (!numbers.length) throw new HttpError(400, 'no_rooms');
  if (numbers.length > 300) throw new HttpError(400, 'too_many_rooms');

  const existing = new Set((await list('rooms', hotel.rowKey)).map((r) => r.number));
  const created = [];
  for (const number of numbers) {
    if (existing.has(number)) continue;
    const roomId = newId('r');
    let code;
    for (;;) {
      code = makeCode();
      try {
        await insert('roomcodes', { partitionKey: 'code', rowKey: code, hotelId: hotel.rowKey, roomId });
        break;
      } catch (e) {
        if (e.statusCode !== 409) throw e; // collision très rare : on retente
      }
    }
    const room = {
      partitionKey: hotel.rowKey,
      rowKey: roomId,
      number,
      floor: str(body.floor, 10) || number.slice(0, -2) || '1',
      code,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };
    await insert('rooms', room);
    created.push(publicRoom(room));
  }
  return { created };
});

route('rooms-delete', ['DELETE'], 'hotels/{hotelId}/rooms/{roomId}', async ({ request, params }) => {
  const user = requireUser(request, 'director');
  const hotel = await loadHotel(params.hotelId, user);
  const room = await get('rooms', hotel.rowKey, params.roomId);
  if (!room) throw new HttpError(404, 'room_not_found');
  await remove('roomcodes', 'code', room.code);
  await remove('rooms', hotel.rowKey, room.rowKey);
  return { ok: true };
});

// Page ouverte par le QR. La réponse dépend de qui scanne.
route('room-by-code', ['GET'], 'r/{code}', async ({ request, params }) => {
  const { room, hotel } = await roomByCode(params.code);
  const user = currentUser(request);
  if (canAccessHotel(user, hotel)) {
    const events = (await list('events', room.rowKey, { limit: 50 })).map(publicEvent);
    return { view: 'staff', role: user.role, hotel: publicHotel(hotel), room: publicRoom(room), events };
  }
  return { view: 'guest', hotel: { name: hotel.name }, room: { number: room.number, occupied: !!room.stayId } };
});

async function staffRoom(request, code) {
  const user = requireUser(request);
  const { room, hotel } = await roomByCode(code);
  if (!canAccessHotel(user, hotel)) throw new HttpError(403, 'forbidden');
  return { user, room, hotel };
}

// Changement de statut. En mode chronométré : « cleaning » démarre le chrono, « done » l'arrête.
route('room-status', ['POST'], 'r/{code}/status', async ({ request, context, params, body }) => {
  const { user, room, hotel } = await staffRoom(request, params.code);
  const status = need(body.status);
  if (!STATUSES.includes(status)) throw new HttpError(400, 'bad_status');
  const now = new Date();
  const patch = { partitionKey: room.partitionKey, rowKey: room.rowKey, status };

  if (status === 'cleaning') {
    patch.cleaningStartedAt = now.toISOString();
    patch.cleaningBy = user.sub;
    await addEvent(room, user, { kind: 'cleaning_start' });
  } else if (status === 'done') {
    const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : null;
    let durationSec = null;
    if (room.status === 'cleaning' && room.cleaningStartedAt) {
      durationSec = Math.round((now - new Date(room.cleaningStartedAt)) / 1000);
    }
    patch.lastCleanedAt = now.toISOString();
    patch.lastCleanedBy = user.name || user.sub;
    patch.cleaningStartedAt = '';
    patch.cleaningBy = '';
    await addEvent(room, user, { kind: 'cleaning_done', durationSec, difficulty });
  } else {
    patch.cleaningStartedAt = '';
    patch.cleaningBy = '';
    await addEvent(room, user, { kind: 'status_todo' });
  }
  await merge('rooms', patch);
  await publish(hotelGroup(hotel.rowKey), { type: 'room', roomId: room.rowKey }, context.log);
  return { room: publicRoom({ ...room, ...patch }), timingMode: !!hotel.timingMode };
});

route('room-comment', ['POST'], 'r/{code}/comments', async ({ request, params, body }) => {
  const { user, room } = await staffRoom(request, params.code);
  const category = COMMENT_CATEGORIES.includes(body.category) ? body.category : 'room';
  const text = str(need(body.text), 1000);
  const ev = await addEvent(room, user, { kind: 'comment', category, text });
  return { event: publicEvent(ev) };
});

// Arrivée du client : génère le code séjour à 4 chiffres.
route('room-checkin', ['POST'], 'r/{code}/checkin', async ({ request, context, params }) => {
  const { user, room } = await staffRoom(request, params.code);
  const patch = {
    partitionKey: room.partitionKey,
    rowKey: room.rowKey,
    stayId: newId('s'),
    stayPin: String(randomInt(10000)).padStart(4, '0'),
    stayStartedAt: new Date().toISOString(),
    pinFails: 0,
    pinLockedUntil: '',
    guestLang: '',
    chatUnread: 0,
  };
  await merge('rooms', patch);
  await addEvent(room, user, { kind: 'checkin' });
  await publish(hotelGroup(room.partitionKey), { type: 'room', roomId: room.rowKey }, context.log);
  return { room: publicRoom({ ...room, ...patch }) };
});

// Départ : le séjour est effacé, les jetons clients de ce séjour ne marchent plus.
route('room-checkout', ['POST'], 'r/{code}/checkout', async ({ request, context, params }) => {
  const { user, room } = await staffRoom(request, params.code);
  const patch = {
    partitionKey: room.partitionKey,
    rowKey: room.rowKey,
    stayId: '',
    stayPin: '',
    stayStartedAt: '',
    status: 'todo',
    guestLang: '',
    chatUnread: 0,
  };
  await merge('rooms', patch);
  await addEvent(room, user, { kind: 'checkout' });
  await publish(hotelGroup(room.partitionKey), { type: 'room', roomId: room.rowKey }, context.log);
  await publish(stayGroup(room.stayId), { type: 'stay_end' }, context.log);
  return { room: publicRoom({ ...room, ...patch }) };
});
