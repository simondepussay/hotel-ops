// Fonctions partagées entre les routes : chargement et forme publique des objets.
import { get } from './db.js';
import { canAccessHotel } from './auth.js';
import { HttpError } from './http.js';

export async function loadHotel(hotelId, user) {
  const hotel = await get('hotels', 'hotel', hotelId);
  if (!hotel) throw new HttpError(404, 'hotel_not_found');
  if (!canAccessHotel(user, hotel)) throw new HttpError(403, 'forbidden');
  return hotel;
}

export function publicHotel(h) {
  return {
    id: h.rowKey,
    name: h.name,
    timingMode: !!h.timingMode,
    plan: h.plan ? JSON.parse(h.plan) : null,
  };
}

// Statuts possibles d'une chambre : todo (à faire), cleaning (en cours), done (faite).
export function publicRoom(r) {
  return {
    id: r.rowKey,
    number: r.number,
    floor: r.floor ?? null,
    code: r.code,
    status: r.status || 'todo',
    lastCleanedAt: r.lastCleanedAt || null,
    lastCleanedBy: r.lastCleanedBy || null,
    cleaningStartedAt: r.cleaningStartedAt || null,
    cleaningBy: r.cleaningBy || null,
    occupied: !!r.stayId,
    stayPin: r.stayPin || null,
    stayStartedAt: r.stayStartedAt || null,
  };
}

// Retrouve la chambre depuis le code imprimé dans le QR.
export async function roomByCode(code) {
  const link = await get('roomcodes', 'code', String(code || '').toUpperCase());
  if (!link) throw new HttpError(404, 'room_not_found');
  const room = await get('rooms', link.hotelId, link.roomId);
  if (!room) throw new HttpError(404, 'room_not_found');
  const hotel = await get('hotels', 'hotel', link.hotelId);
  if (!hotel) throw new HttpError(404, 'hotel_not_found');
  return { room, hotel };
}
