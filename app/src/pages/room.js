// Page ouverte par le QR de la chambre : vue staff si connecté à cet hôtel, sinon vue client.
import { h, fill, mount } from '../dom.js';
import { t, errText, ago, dateTime, lang as staffLang } from '../i18n/staff.js';
import { gt, guestLang, setGuestLang, GUEST_LANGS } from '../i18n/guest.js';
import { api, guestToken } from '../api.js';
import { topBar, loading, formatDuration } from './common.js';
import { icon } from '../icons.js';

export async function roomPage(code) {
  mount(loading());
  let data;
  try {
    data = await api(`r/${code}`);
  } catch (e) {
    return mount(h('section', { class: 'page narrow' }, h('p', { class: 'error' }, errText(e))));
  }
  return data.view === 'staff' ? staffRoom(code, data) : guestRoom(code, data);
}

/* ------------------------------------------------------------------ */
/* Vue staff / director                                                */
/* ------------------------------------------------------------------ */

function staffRoom(code, data) {
  let { room, hotel, events } = data;
  let askDifficulty = false;
  let category = 'cleaning';
  let tick = null;

  async function reload() {
    ({ room, hotel, events } = await api(`r/${code}`));
    draw();
  }

  async function setStatus(status, difficulty) {
    await api(`r/${code}/status`, { method: 'POST', body: { status, difficulty } });
    askDifficulty = false;
    await reload();
  }

  function statusActions() {
    if (askDifficulty) {
      return h(
        'div',
        { class: 'stack' },
        h('h2', { class: 'center' }, t('howHard')),
        h(
          'div',
          { class: 'difficulty' },
          ['easy', 'normal', 'hard'].map((d) =>
            h('button', { class: `btn-big diff-${d}`, onClick: () => setStatus('done', d) }, icon(d, 28), t(d)),
          ),
        ),
      );
    }
    if (hotel.timingMode) {
      if (room.status === 'cleaning') {
        const clock = h('p', { class: 'clock' }, '0:00');
        const update = () => {
          const sec = Math.max(0, Math.round((Date.now() - new Date(room.cleaningStartedAt)) / 1000));
          clock.textContent = formatDuration(sec);
        };
        update();
        tick = setInterval(update, 1000);
        return h(
          'div',
          { class: 'stack' },
          h('p', { class: 'center with-icon' }, icon('clock', 20), t('elapsed')),
          clock,
          h(
            'button',
            {
              class: 'btn-huge btn-success',
              onClick: () => {
                askDifficulty = true;
                draw();
              },
            },
            icon('stop', 30),
            t('finishCleaning'),
          ),
        );
      }
      return h(
        'div',
        { class: 'stack' },
        h('button', { class: 'btn-huge btn-primary', onClick: () => setStatus('cleaning') }, icon('play', 30), t('startCleaning')),
        room.status === 'done'
          ? h('button', { class: 'btn-big btn-neutral', onClick: () => setStatus('todo') }, icon('undo'), t('markTodo'))
          : null,
      );
    }
    return room.status === 'done'
      ? h('button', { class: 'btn-huge btn-neutral', onClick: () => setStatus('todo') }, icon('undo', 30), t('markTodo'))
      : h('button', { class: 'btn-huge btn-success', onClick: () => setStatus('done') }, icon('check', 30), t('markDone'));
  }

  function stayBlock() {
    if (room.occupied) {
      return h(
        'div',
        { class: 'card stack' },
        h('p', { class: 'with-icon' }, icon('key', 20), t('stayPin')),
        h('p', { class: 'pin' }, room.stayPin),
        h(
          'button',
          {
            class: 'btn-big btn-neutral',
            onClick: async () => {
              if (!confirm(t('confirmCheckout'))) return;
              await api(`r/${code}/checkout`, { method: 'POST' });
              reload();
            },
          },
          icon('door'),
          t('checkout'),
        ),
      );
    }
    return h(
      'div',
      { class: 'card stack' },
      h('p', null, t('noStay')),
      h(
        'button',
        {
          class: 'btn-big btn-primary',
          onClick: async () => {
            await api(`r/${code}/checkin`, { method: 'POST' });
            reload();
          },
        },
        icon('bell'),
        t('checkin'),
      ),
    );
  }

  function commentBlock() {
    const text = h('textarea', { rows: 3, placeholder: t('commentPlaceholder'), maxlength: 1000 });
    const cats = [
      ['cleaning', t('catCleaning'), 'broom'],
      ['consumption', t('catConsumption'), 'cup'],
      ['room', t('catRoom'), 'bed'],
    ];
    return h(
      'form',
      {
        class: 'card stack',
        onSubmit: async (e) => {
          e.preventDefault();
          if (!text.value.trim()) return;
          await api(`r/${code}/comments`, { method: 'POST', body: { category, text: text.value } });
          reload();
        },
      },
      h('h2', null, t('addComment')),
      h(
        'div',
        { class: 'segmented' },
        cats.map(([k, label, ic]) =>
          h(
            'button',
            {
              type: 'button',
              class: category === k ? 'active' : '',
              onClick: (e) => {
                category = k;
                e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
              },
            },
            icon(ic),
            label,
          ),
        ),
      ),
      text,
      h('button', { class: 'btn-big btn-primary', type: 'submit' }, icon('send'), t('send')),
    );
  }

  function historyBlock() {
    const durations = events.filter((e) => e.kind === 'cleaning_done' && e.durationSec).map((e) => e.durationSec);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const catLabel = { cleaning: t('catCleaning'), consumption: t('catConsumption'), room: t('catRoom') };
    const catIcon = { cleaning: 'broom', consumption: 'cup', room: 'bed' };
    const evIcon = { cleaning_start: 'play', cleaning_done: 'done', status_todo: 'undo', checkin: 'bell', checkout: 'door' };
    return h(
      'div',
      { class: 'stack' },
      h('h2', null, t('history')),
      avg !== null ? h('p', { class: 'with-icon' }, icon('clock', 20), `${t('avgTime')} : ${formatDuration(avg)} (${durations.length})`) : null,
      events.length
        ? h(
            'ul',
            { class: 'history' },
            events.map((e) =>
              h(
                'li',
                { class: 'ev-' + e.kind },
                h(
                  'div',
                  { class: 'ev-head' },
                  h('strong', { class: 'with-icon' }, icon(e.kind === 'comment' ? catIcon[e.category] || 'chat' : evIcon[e.kind] || 'clock', 18), e.kind === 'comment' ? catLabel[e.category] : t('ev_' + e.kind)),
                  h('small', null, `${dateTime(e.at)}${e.byName ? ' · ' + e.byName : ''}`),
                ),
                e.text ? h('p', null, e.text) : null,
                e.durationSec ? h('small', { class: 'with-icon' }, icon('clock', 14), formatDuration(e.durationSec)) : null,
                e.difficulty ? h('small', { class: 'with-icon' }, ' · ', icon(e.difficulty, 14), t(e.difficulty)) : null,
              ),
            ),
          )
        : h('p', { class: 'empty' }, t('noHistory')),
    );
  }

  function draw() {
    clearInterval(tick);
    mount(
      topBar(hotel.name, { back: `/h/${hotel.id}` }),
      h(
        'section',
        { class: 'page narrow stack' },
        h(
          'div',
          { class: `status-banner status-${room.status}` },
          h('span', { class: 'status-room' }, room.number),
          h('span', { class: 'status-label' }, t(room.status)),
          h('small', null, `${t('lastCleaned')} : ${ago(room.lastCleanedAt)}${room.lastCleanedBy ? ` ${t('by')} ${room.lastCleanedBy}` : ''}`),
        ),
        statusActions(),
        stayBlock(),
        commentBlock(),
        historyBlock(),
      ),
    );
  }

  draw();
  return () => clearInterval(tick);
}

/* ------------------------------------------------------------------ */
/* Vue client (sans compte), au style de Clean Work : blanc, bleus,    */
/* bordeaux pour l'action principale, vagues pâles en arrière-plan.    */
/* ------------------------------------------------------------------ */

export const KIND_ICONS = { towels: 'towel', cleaning: 'sparkle', amenities: 'bottle', problem: 'wrench', other: 'chat' };
const KINDS = Object.entries(KIND_ICONS);
const WELCOME = ['ようこそ', 'Welcome', '欢迎', '환영합니다'];

function guestRoom(code, data) {
  let token = guestToken.get(code);
  let choosing = !guestLang();
  let menuOpen = false;
  let selected = null;
  let notice = '';
  document.body.classList.add('guest-mode');

  function chooseLang(k) {
    setGuestLang(k);
    choosing = false;
    menuOpen = false;
    draw();
  }

  // Globe rond avec le code de la langue, et petit menu (comme dans Clean Work).
  function languageMenu() {
    const current = guestLang();
    return h(
      'div',
      { class: 'g-language' },
      h(
        'button',
        {
          class: 'g-round',
          'aria-label': gt('changeLang'),
          'aria-expanded': String(menuOpen),
          onClick: () => {
            menuOpen = !menuOpen;
            draw();
          },
        },
        icon('globe', 20),
        current ? h('span', { class: 'g-code' }, current.toUpperCase()) : null,
      ),
      menuOpen
        ? h(
            'div',
            { class: 'g-menu', role: 'menu' },
            h('p', { class: 'g-menu-title' }, gt('changeLang')),
            Object.entries(GUEST_LANGS).map(([k, label]) =>
              h(
                'button',
                { role: 'menuitemradio', 'aria-checked': String(k === current), lang: k, onClick: () => chooseLang(k) },
                label,
                k === current ? icon('check', 18) : null,
              ),
            ),
          )
        : null,
    );
  }

  function header() {
    return h(
      'header',
      { class: 'g-topbar' },
      h(
        'div',
        { class: 'g-brand' },
        h('span', { class: 'g-brand-mark' }, icon('building', 20)),
        h('span', null, data.hotel.name),
      ),
      choosing ? null : languageMenu(),
    );
  }

  function hero(title, lead) {
    return h(
      'div',
      { class: 'g-hero' },
      h('p', { class: 'g-eyebrow' }, `${gt('room')} ${data.room.number}`),
      h('h1', null, title),
      lead ? h('p', { class: 'g-lead' }, lead) : null,
    );
  }

  function footer() {
    return h(
      'footer',
      { class: 'g-footer' },
      h('span', null, data.hotel.name),
      h('a', { href: `/login?next=/r/${code}`, 'data-link': true }, 'Staff'),
    );
  }

  function langChooser() {
    return h(
      'section',
      { class: 'g-shell' },
      h('div', { class: 'g-hero center' }, h('p', { class: 'g-eyebrow' }, `Room ${data.room.number}`), h('h1', { class: 'g-welcome' }, WELCOME.map((w) => h('span', null, w)))),
      h(
        'div',
        { class: 'g-card g-lang-list' },
        Object.entries(GUEST_LANGS).map(([k, label]) =>
          h('button', { lang: k, onClick: () => chooseLang(k) }, h('span', null, label), icon('next', 18)),
        ),
      ),
    );
  }

  function pinForm() {
    if (!data.room.occupied) {
      return h('div', { class: 'g-card g-info' }, icon('bell', 28), h('p', null, gt('noStay')));
    }
    const err = h('p', { class: 'g-error', hidden: true });
    const input = h('input', {
      class: 'g-pin',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: 4,
      autocomplete: 'one-time-code',
      'aria-label': gt('enterPin'),
    });
    return h(
      'form',
      {
        class: 'g-card g-stack',
        onSubmit: async (e) => {
          e.preventDefault();
          try {
            const res = await api(`r/${code}/join`, { method: 'POST', body: { pin: input.value.trim() } });
            token = res.token;
            guestToken.set(code, token);
            notice = '';
            draw();
          } catch (ex) {
            err.textContent = ex.code === 'locked' ? gt('locked') : ex.code === 'bad_pin' ? gt('badPin') : gt('error');
            err.hidden = false;
          }
        },
      },
      h('p', { class: 'g-with-icon' }, icon('key', 20), gt('enterPin')),
      input,
      err,
      h('button', { class: 'g-primary', type: 'submit' }, gt('join'), icon('arrow', 18)),
    );
  }

  async function mainView(container) {
    let requests = [];
    try {
      ({ requests } = await api(`r/${code}/requests`, { guest: token }));
    } catch (e) {
      if (e.code === 'stay_expired') {
        guestToken.clear(code);
        token = null;
        notice = gt('stayExpired');
        return draw();
      }
    }
    const text = h('textarea', { rows: 3, placeholder: gt('messagePlaceholder'), maxlength: 500 });
    fill(
      container,
      hero(gt('welcome'), gt('whatNeed')),
      notice ? h('p', { class: 'g-notice', role: 'status' }, icon('check', 18), notice) : null,
      h(
        'div',
        { class: 'g-kinds' },
        KINDS.map(([k, ic]) =>
          h(
            'button',
            {
              class: 'g-kind' + (selected === k ? ' current' : ''),
              'aria-pressed': String(selected === k),
              onClick: () => {
                selected = k;
                notice = '';
                mainView(container);
              },
            },
            h('span', { class: 'g-kind-icon' }, icon(ic, 26)),
            h('span', null, gt(k)),
          ),
        ),
      ),
      selected
        ? h(
            'form',
            {
              class: 'g-card g-stack',
              onSubmit: async (e) => {
                e.preventDefault();
                if (selected === 'other' && !text.value.trim()) return;
                try {
                  await api(`r/${code}/requests`, {
                    method: 'POST',
                    guest: token,
                    body: { kind: selected, text: text.value, lang: guestLang() },
                  });
                  selected = null;
                  notice = gt('sent');
                } catch {
                  notice = gt('error');
                }
                mainView(container);
              },
            },
            h('h2', { class: 'g-with-icon' }, icon(KIND_ICONS[selected], 22), gt(selected)),
            text,
            h(
              'div',
              { class: 'g-actions' },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    selected = null;
                    mainView(container);
                  },
                },
                gt('cancel'),
              ),
              h('button', { class: 'g-primary', type: 'submit' }, icon('send', 18), gt('send')),
            ),
          )
        : null,
      requests.length ? h('h2', { class: 'g-section' }, gt('myRequests')) : null,
      requests.length
        ? h(
            'ul',
            { class: 'g-requests' },
            requests.map((r) =>
              h(
                'li',
                { class: 'g-card ' + r.status },
                h('span', { class: 'g-kind-icon small' }, icon(KIND_ICONS[r.kind] || 'chat', 20)),
                h('div', { class: 'g-request-main' }, h('strong', null, gt(r.kind)), r.text ? h('p', null, r.text) : null),
                h(
                  'span',
                  { class: 'g-pill ' + r.status },
                  r.status === 'done' ? icon('check', 14) : icon('clock', 14),
                  r.status === 'done' ? gt('statusDone') : gt('statusOpen'),
                ),
              ),
            ),
          )
        : null,
    );
  }

  let poll = null;
  function draw() {
    clearInterval(poll);
    document.documentElement.lang = guestLang() || 'en';
    const waves = h('div', { class: 'waves', 'aria-hidden': 'true' });
    if (choosing) return mount(waves, header(), langChooser(), footer());
    if (!token) {
      return mount(
        waves,
        header(),
        h(
          'section',
          { class: 'g-shell' },
          hero(gt('welcome'), null),
          notice ? h('p', { class: 'g-notice' }, notice) : null,
          pinForm(),
        ),
        footer(),
      );
    }
    const container = h('section', { class: 'g-shell' }, loading());
    mount(waves, header(), container, footer());
    mainView(container);
    // Rafraîchit le statut des demandes (le chat temps réel viendra en phase 3).
    poll = setInterval(() => !selected && !menuOpen && mainView(container), 20000);
  }

  draw();
  return () => {
    clearInterval(poll);
    document.body.classList.remove('guest-mode');
    document.documentElement.lang = staffLang;
  };
}
