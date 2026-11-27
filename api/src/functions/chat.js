// Chat entre le client et le staff, un fil par séjour.
// Chaque message est traduit à l'envoi : celui du client dans les langues du staff (ja, en, fr),
// celui du staff dans la langue du client. Les deux côtés voient aussi le texte d'origine.
import { route, need, str, HttpError } from '../lib/http.js';
import { list, merge, insert, timeKey } from '../lib/db.js';
import { currentUser, canAccessHotel } from '../lib/auth.js';
import { roomByCode, guestStay } from '../lib/model.js';
import { translate, STAFF_LANGS } from '../lib/translate.js';
import { publish, hotelGroup, stayGroup } from '../lib/realtime.js';
import { GUEST_LANGS } from './guest.js';

// Le même chemin sert au client (jeton séjour) et au staff (jeton de compte).
async function chatAccess(request, code) {
  const user = currentUser(request);
  if (user) {
    const { room, hotel } = await roomByCode(code);
    if (canAccessHotel(user, hotel)) {
      if (!room.stayId) throw new HttpError(409, 'no_stay');
      return { who: 'staff', user, room, hotel, stayId: room.stayId };
    }
  }
  const { room, hotel, stayId } = await guestStay(request, code);
  return { who: 'guest', user: null, room, hotel, stayId };
}

function publicMessage(m) {
  return {
    id: m.rowKey,
    from: m.from,
    byName: m.byName || null,
    text: m.text,
    lang: m.lang || null,
    tr: m.tr ? JSON.parse(m.tr) : {},
    at: m.at,
  };
}

route('chat-list', ['GET'], 'r/{code}/messages', async ({ request, context, params }) => {
  const { who, room, hotel, stayId } = await chatAccess(request, params.code);
  const messages = (await list('messages', stayId, { limit: 500 })).map(publicMessage);
  // Le staff a lu : on efface le compteur de messages non lus de la chambre.
  if (who === 'staff' && room.chatUnread) {
    await merge('rooms', { partitionKey: room.partitionKey, rowKey: room.rowKey, chatUnread: 0 });
    await publish(hotelGroup(hotel.rowKey), { type: 'room', roomId: room.rowKey }, context.log);
  }
  return { messages, guestLang: room.guestLang || null };
});

route('chat-send', ['POST'], 'r/{code}/messages', async ({ request, context, params, body }) => {
  const { who, user, room, hotel, stayId } = await chatAccess(request, params.code);
  const text = str(need(body.text), 1000);
  if (!text) throw new HttpError(400, 'bad_request');

  const declared = GUEST_LANGS.includes(body.lang) ? body.lang : null;
  const guestLang = (who === 'guest' ? declared : null) || room.guestLang || 'en';
  // Translator détecte la langue réellement écrite ; on traduit vers les langues de l'autre côté.
  const targets = who === 'guest' ? STAFF_LANGS : [guestLang, ...STAFF_LANGS];
  const { from, tr } = await translate(text, targets, { log: context.log });

  const msg = {
    partitionKey: stayId,
    rowKey: timeKey(),
    from: who,
    byName: who === 'staff' ? user.name || user.sub : '',
    text,
    lang: from || (who === 'guest' ? guestLang : ''),
    tr: JSON.stringify(tr),
    at: new Date().toISOString(),
    roomId: room.rowKey,
    roomNumber: room.number,
  };
  await insert('messages', msg);

  if (who === 'guest') {
    await merge('rooms', {
      partitionKey: room.partitionKey,
      rowKey: room.rowKey,
      chatUnread: (room.chatUnread || 0) + 1,
      guestLang,
    });
  }
  const signal = { type: 'message', roomId: room.rowKey, roomNumber: room.number, from: who };
  await publish(stayGroup(stayId), signal, context.log);
  await publish(hotelGroup(hotel.rowKey), signal, context.log);
  return { message: publicMessage(msg) };
});
