import { h } from '../dom.js';
import { t, lang, setLang, STAFF_LANGS } from '../i18n/staff.js';
import { session } from '../api.js';
import { navigate, render } from '../main.js';

// Barre du haut pour le staff / director.
export function topBar(title, { back } = {}) {
  const user = session.user;
  return h(
    'header',
    { class: 'topbar' },
    back ? h('a', { href: back, 'data-link': true, class: 'topbar-back' }, t('back')) : null,
    h('h1', null, title),
    h(
      'div',
      { class: 'topbar-right' },
      h(
        'select',
        {
          class: 'lang-select',
          'aria-label': 'Language',
          onChange: (e) => {
            setLang(e.target.value);
            render();
          },
        },
        Object.entries(STAFF_LANGS).map(([k, v]) => h('option', { value: k, selected: k === lang }, v)),
      ),
      user
        ? h(
            'button',
            {
              class: 'btn-small',
              onClick: () => {
                session.clear();
                navigate('/login');
              },
            },
            t('logout'),
          )
        : null,
    ),
  );
}

export function errorBox() {
  return h('p', { class: 'error', role: 'alert', hidden: true });
}

export function showError(box, text) {
  box.textContent = text;
  box.hidden = !text;
}

export function loading() {
  return h('p', { class: 'loading' }, '…');
}

// Découpe « 101-110, 201 » en liste de numéros.
export function parseRoomNumbers(input) {
  const out = [];
  for (const part of String(input).split(/[,\s、，]+/)) {
    if (!part) continue;
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      for (let n = Math.min(a, b); n <= Math.max(a, b) && out.length < 300; n++) out.push(String(n));
    } else out.push(part);
  }
  return out;
}

export function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
