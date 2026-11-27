// Page ouverte par le QR de la chambre : vue staff si connecté à cet hôtel, sinon vue client.
import { h, fill, mount } from '../dom.js';
import { t, errText, ago, dateTime } from '../i18n/staff.js';
import { gt, guestLang, setGuestLang, GUEST_LANGS } from '../i18n/guest.js';
import { api, guestToken } from '../api.js';
import { topBar, loading, formatDuration } from './common.js';

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
            h('button', { class: `btn-big diff-${d}`, onClick: () => setStatus('done', d) }, t(d)),
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
          h('p', { class: 'center' }, `⏱ ${t('elapsed')}`),
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
            t('finishCleaning'),
          ),
        );
      }
      return h(
        'div',
        { class: 'stack' },
        h('button', { class: 'btn-huge btn-primary', onClick: () => setStatus('cleaning') }, t('startCleaning')),
        room.status === 'done'
          ? h('button', { class: 'btn-big btn-neutral', onClick: () => setStatus('todo') }, t('markTodo'))
          : null,
      );
    }
    return room.status === 'done'
      ? h('button', { class: 'btn-huge btn-neutral', onClick: () => setStatus('todo') }, t('markTodo'))
      : h('button', { class: 'btn-huge btn-success', onClick: () => setStatus('done') }, t('markDone'));
  }

  function stayBlock() {
    if (room.occupied) {
      return h(
        'div',
        { class: 'card stack' },
        h('p', null, t('stayPin')),
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
        t('checkin'),
      ),
    );
  }

  function commentBlock() {
    const text = h('textarea', { rows: 3, placeholder: t('commentPlaceholder'), maxlength: 1000 });
    const cats = [
      ['cleaning', t('catCleaning')],
      ['consumption', t('catConsumption')],
      ['room', t('catRoom')],
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
        cats.map(([k, label]) =>
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
            label,
          ),
        ),
      ),
      text,
      h('button', { class: 'btn-big btn-primary', type: 'submit' }, t('send')),
    );
  }

  function historyBlock() {
    const durations = events.filter((e) => e.kind === 'cleaning_done' && e.durationSec).map((e) => e.durationSec);
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const catLabel = { cleaning: t('catCleaning'), consumption: t('catConsumption'), room: t('catRoom') };
    return h(
      'div',
      { class: 'stack' },
      h('h2', null, t('history')),
      avg !== null ? h('p', null, `⏱ ${t('avgTime')} : ${formatDuration(avg)} (${durations.length})`) : null,
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
                  h('strong', null, e.kind === 'comment' ? catLabel[e.category] : t('ev_' + e.kind)),
                  h('small', null, `${dateTime(e.at)}${e.byName ? ' · ' + e.byName : ''}`),
                ),
                e.text ? h('p', null, e.text) : null,
                e.durationSec ? h('small', null, `⏱ ${formatDuration(e.durationSec)}`) : null,
                e.difficulty ? h('small', null, ` · ${t(e.difficulty)}`) : null,
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
/* Vue client (sans compte)                                            */
/* ------------------------------------------------------------------ */

const KINDS = [
  ['towels', '🧺'],
  ['cleaning', '🧹'],
  ['amenities', '🧴'],
  ['problem', '🔧'],
  ['other', '💬'],
];

function guestRoom(code, data) {
  let token = guestToken.get(code);
  let choosing = !guestLang();
  let selected = null;
  let notice = '';

  function header() {
    return h(
      'header',
      { class: 'guest-header' },
      h('div', null, h('small', null, data.hotel.name), h('h1', null, `${gt('room')} ${data.room.number}`)),
      !choosing
        ? h(
            'button',
            {
              class: 'btn-small',
              onClick: () => {
                choosing = true;
                draw();
              },
            },
            '🌐 ',
            GUEST_LANGS[guestLang()] || gt('changeLang'),
          )
        : null,
    );
  }

  function footer() {
    return h('footer', { class: 'guest-footer' }, h('a', { href: `/login?next=/r/${code}`, 'data-link': true }, 'Staff'));
  }

  function langChooser() {
    return h(
      'section',
      { class: 'page narrow stack' },
      h('h2', { class: 'center' }, gt('chooseLang')),
      h(
        'div',
        { class: 'lang-grid' },
        Object.entries(GUEST_LANGS).map(([k, label]) =>
          h(
            'button',
            {
              class: 'btn-big btn-tile',
              lang: k,
              onClick: () => {
                setGuestLang(k);
                document.documentElement.lang = k;
                choosing = false;
                draw();
              },
            },
            label,
          ),
        ),
      ),
    );
  }

  function pinForm() {
    if (!data.room.occupied) return h('p', { class: 'card center' }, gt('noStay'));
    const err = h('p', { class: 'error', hidden: true });
    const input = h('input', {
      class: 'pin-input',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: 4,
      autocomplete: 'one-time-code',
      'aria-label': gt('enterPin'),
    });
    return h(
      'form',
      {
        class: 'card stack',
        onSubmit: async (e) => {
          e.preventDefault();
          try {
            const res = await api(`r/${code}/join`, { method: 'POST', body: { pin: input.value.trim() } });
            token = res.token;
            guestToken.set(code, token);
            draw();
          } catch (ex) {
            err.textContent = ex.code === 'locked' ? gt('locked') : ex.code === 'bad_pin' ? gt('badPin') : gt('error');
            err.hidden = false;
          }
        },
      },
      h('p', { class: 'center' }, gt('enterPin')),
      input,
      err,
      h('button', { class: 'btn-big btn-primary', type: 'submit' }, gt('join')),
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
    fill(container, 
      notice ? h('p', { class: 'ok' }, notice) : null,
      h('h2', { class: 'center' }, gt('whatNeed')),
      h(
        'div',
        { class: 'kind-grid' },
        KINDS.map(([k, icon]) =>
          h(
            'button',
            {
              class: 'btn-big btn-tile' + (selected === k ? ' active' : ''),
              onClick: () => {
                selected = k;
                notice = '';
                mainView(container);
              },
            },
            h('span', { class: 'kind-icon' }, icon),
            gt(k),
          ),
        ),
      ),
      selected
        ? h(
            'form',
            {
              class: 'card stack',
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
            h('strong', null, gt(selected)),
            text,
            h('button', { class: 'btn-big btn-primary', type: 'submit' }, gt('send')),
            h(
              'button',
              {
                type: 'button',
                class: 'btn-link',
                onClick: () => {
                  selected = null;
                  mainView(container);
                },
              },
              gt('cancel'),
            ),
          )
        : null,
      requests.length ? h('h2', null, gt('myRequests')) : null,
      h(
        'ul',
        { class: 'requests' },
        requests.map((r) =>
          h(
            'li',
            { class: 'request ' + r.status },
            h(
              'div',
              { class: 'request-main' },
              h('strong', null, gt(r.kind)),
              r.text ? h('p', { class: 'request-text' }, r.text) : null,
            ),
            h('span', { class: 'pill ' + r.status }, r.status === 'done' ? gt('statusDone') : gt('statusOpen')),
          ),
        ),
      ),
    );
  }

  let poll = null;
  function draw() {
    clearInterval(poll);
    document.documentElement.lang = guestLang() || 'en';
    if (choosing) return mount(header(), langChooser(), footer());
    if (!token) {
      return mount(
        header(),
        h('section', { class: 'page narrow stack' }, notice ? h('p', { class: 'ok' }, notice) : null, pinForm()),
        footer(),
      );
    }
    const container = h('section', { class: 'page narrow stack' }, loading());
    mount(header(), container, footer());
    mainView(container);
    // Rafraîchit le statut des demandes (le chat temps réel viendra en phase 3).
    poll = setInterval(() => !selected && mainView(container), 20000);
  }

  draw();
  return () => clearInterval(poll);
}
