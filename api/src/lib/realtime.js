// Temps réel avec Azure Web PubSub. Le serveur envoie, les navigateurs écoutent seulement.
// Sans chaîne de connexion (en local), rien n'est envoyé et les pages se rafraîchissent toutes seules
// à intervalle régulier.
import { WebPubSubServiceClient } from '@azure/web-pubsub';

const conn = process.env.WEBPUBSUB_CONNECTION;
const service = conn ? new WebPubSubServiceClient(conn, 'hotelops') : null;

export const hotelGroup = (hotelId) => `hotel.${hotelId}`;
export const stayGroup = (stayId) => `stay.${stayId}`;

// Adresse WebSocket pour un navigateur. Le jeton ne donne aucun droit d'envoi ni de changer de
// groupe : le navigateur reçoit seulement les messages des groupes donnés ici.
export async function clientUrl(userId, groups) {
  if (!service) return null;
  const { url } = await service.getClientAccessToken({ userId, groups, expirationTimeInMinutes: 120 });
  return url;
}

// Envoie un petit signal ({ type, ... }) à un groupe. Une panne ici ne doit pas faire échouer la requête.
export async function publish(group, data, log) {
  if (!service || !group) return;
  try {
    await service.group(group).sendToAll(data);
  } catch (e) {
    log?.(`publish failed: ${e.message}`);
  }
}
