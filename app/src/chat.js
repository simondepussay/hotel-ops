// Fil de discussion, partagé entre la vue client et la vue staff.
// Les messages de l'autre côté s'affichent traduits dans la langue de la personne qui lit,
// avec un bouton pour voir le texte d'origine.
import { h } from './dom.js';
import { icon } from './icons.js';

/**
 * @param messages  liste renvoyée par l'API
 * @param me        'guest' ou 'staff' : mes messages sont à droite
 * @param viewLang  langue de la personne qui lit
 * @param labels    { original, translation, empty, staff, guest }
 * @param time      fonction qui formate l'heure
 */
export function chatThread(messages, { me, viewLang, labels, time }) {
  if (!messages.length) return h('p', { class: 'chat-empty' }, labels.empty);
  return h(
    'ol',
    { class: 'chat-thread' },
    messages.map((m) => {
      const mine = m.from === me;
      const translated = !mine && m.lang !== viewLang ? m.tr?.[viewLang] : null;
      const textEl = h('p', { class: 'chat-text', lang: translated ? viewLang : m.lang || null }, translated || m.text);
      let showingOriginal = false;
      const toggle = translated
        ? h(
            'button',
            {
              type: 'button',
              class: 'chat-toggle',
              onClick: () => {
                showingOriginal = !showingOriginal;
                textEl.textContent = showingOriginal ? m.text : translated;
                textEl.lang = showingOriginal ? m.lang || '' : viewLang;
                toggle.lastChild.textContent = showingOriginal ? labels.translation : labels.original;
              },
            },
            icon('globe', 14),
            h('span', null, labels.original),
          )
        : null;
      const who = m.from === 'staff' ? m.byName || labels.staff : labels.guest;
      return h(
        'li',
        { class: 'chat-msg ' + (mine ? 'mine' : 'theirs') },
        h('div', { class: 'chat-bubble' }, textEl, toggle),
        h('small', { class: 'chat-meta' }, mine ? time(m.at) : `${who} · ${time(m.at)}`),
      );
    }),
  );
}

// Fait défiler le fil jusqu'au dernier message.
export function scrollToEnd(el) {
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}
