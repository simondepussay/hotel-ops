// Connexion temps réel (Azure Web PubSub). Le serveur pousse de petits signaux
// ({ type: 'message' | 'request' | 'room' | 'stay_end', ... }) et la page recharge ce qui a changé.
// Si le temps réel n'est pas configuré (en local), `url` vaut null et la page garde son
// rafraîchissement régulier.
import { api } from './api.js';

export function live(path, onEvent, { guest } = {}) {
  let ws = null;
  let stopped = false;
  let timer = null;
  let delay = 1000;

  function retry() {
    if (stopped) return;
    timer = setTimeout(open, delay);
    delay = Math.min(delay * 2, 30000);
  }

  async function open() {
    if (stopped) return;
    let url;
    try {
      ({ url } = await api(path, { guest }));
    } catch (e) {
      if (e.code === 'stay_expired') return onEvent({ type: 'stay_end' });
      return retry();
    }
    if (stopped || !url) return;
    ws = new WebSocket(url);
    ws.onopen = () => {
      delay = 1000;
      onEvent({ type: 'connected' });
    };
    ws.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        /* signal illisible : ignoré */
      }
    };
    // Le jeton expire au bout de 2 h, ou le réseau coupe : on se reconnecte.
    ws.onclose = () => {
      ws = null;
      retry();
    };
  }

  // Au retour sur l'onglet (téléphone en veille), on se reconnecte tout de suite.
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || stopped) return;
    onEvent({ type: 'connected' });
    if (!ws) {
      clearTimeout(timer);
      delay = 1000;
      open();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  open();
  return {
    get connected() {
      return ws?.readyState === WebSocket.OPEN;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      ws?.close();
    },
  };
}
