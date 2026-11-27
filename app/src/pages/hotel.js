import { h, fill, mount, formData, store } from '../dom.js';
import { t, errText, ago, lang } from '../i18n/staff.js';
import { kindLabel } from '../i18n/guest.js';
import { icon } from '../icons.js';
import { KIND_ICONS } from './room.js';
import { api, session } from '../api.js';
import { navigate } from '../main.js';
import { topBar, errorBox, showError, loading, parseRoomNumbers } from './common.js';


export async function hotelPage(hotelId) {
  const isDirector = session.user?.role === 'director';
  let data;
  let filter = store('hotelops.filter') || 'all';
  let tab = new URLSearchParams(location.search).get('tab') || 'rooms';
  let timer = null;

  const body = h('section', { class: 'page' });

  async function load() {
    try {
      data = await api(`hotels/${hotelId}`);
    } catch (e) {
      if (e.status === 401) return navigate(`/login?next=/h/${hotelId}`, true);
      fill(body, h('p', { class: 'error' }, errText(e)));
      return;
    }
    draw();
  }

  function setTab(next) {
    tab = next;
    history.replaceState(null, '', `/h/${hotelId}?tab=${next}`);
    draw();
  }

  function draw() {
    const tabs = [
      ['rooms', t('tabRooms'), 'grid'],
      ['requests', t('tabRequests'), 'inbox'],
      ...(isDirector ? [['team', t('tabTeam'), 'users'], ['settings', t('tabSettings'), 'settings']] : []),
    ];
    mount(
      topBar(data.hotel.name, { back: isDirector ? '/' : null }),
      h(
        'nav',
        { class: 'tabs' },
        tabs.map(([k, label, ic]) =>
          h('button', { class: 'tab' + (tab === k ? ' active' : ''), onClick: () => setTab(k) }, icon(ic, 20), h('span', null, label)),
        ),
      ),
      body,
    );
    clearInterval(timer);
    if (tab === 'rooms') drawRooms();
    else if (tab === 'requests') drawRequests();
    else if (tab === 'team') drawTeam();
    else drawSettings();
  }

  // --- Chambres : grandes tuiles colorées selon l'état ---
  function drawRooms() {
    const counts = { all: data.rooms.length, todo: 0, cleaning: 0, done: 0 };
    data.rooms.forEach((r) => counts[r.status]++);
    const rooms = data.rooms.filter((r) => filter === 'all' || r.status === filter);
    fill(body, 
      h(
        'div',
        { class: 'filters' },
        ['all', 'todo', 'cleaning', 'done'].map((f) =>
          h(
            'button',
            {
              class: `filter status-${f}` + (filter === f ? ' active' : ''),
              onClick: () => {
                filter = f;
                store('hotelops.filter', f);
                drawRooms();
              },
            },
            `${t(f)} (${counts[f]})`,
          ),
        ),
      ),
      rooms.length
        ? h(
            'div',
            { class: 'room-grid' },
            rooms.map((r) =>
              h(
                'a',
                { href: `/r/${r.code}`, 'data-link': true, class: `room-tile status-${r.status}` },
                h('span', { class: 'room-number' }, r.number),
                h('span', { class: 'room-state' }, icon(r.status, 20), t(r.status)),
                r.occupied ? h('span', { class: 'room-badge' }, icon('user', 16), t('occupied')) : null,
                h('span', { class: 'room-meta' }, ago(r.lastCleanedAt)),
              ),
            ),
          )
        : h('p', { class: 'empty' }, t('noRooms')),
    );
    timer = setInterval(refreshRooms, 20000);
  }

  async function refreshRooms() {
    try {
      data = await api(`hotels/${hotelId}`);
      if (tab === 'rooms') drawRooms();
    } catch {
      /* on réessaiera au prochain tour */
    }
  }

  // --- Demandes des clients ---
  async function drawRequests() {
    fill(body, loading());
    let requests = [];
    try {
      ({ requests } = await api(`hotels/${hotelId}/requests`));
    } catch (e) {
      fill(body, h('p', { class: 'error' }, errText(e)));
      return;
    }
    const open = requests.filter((r) => r.status === 'open');
    const done = requests.filter((r) => r.status === 'done').slice(0, 20);
    const item = (r) =>
      h(
        'li',
        { class: 'request ' + r.status },
        h(
          'div',
          { class: 'request-main' },
          h('strong', { class: 'request-room' }, `${t('room')} ${r.roomNumber}`),
          h('span', { class: 'request-kind' }, icon(KIND_ICONS[r.kind] || 'chat', 18), kindLabel(r.kind, lang)),
          r.text ? h('p', { class: 'request-text' }, r.text, r.lang ? h('small', null, ` (${r.lang})`) : null) : null,
          h('small', null, ago(r.at), r.doneBy ? ` · ${r.doneBy}` : ''),
        ),
        r.status === 'open'
          ? h(
              'button',
              {
                class: 'btn-big btn-success',
                onClick: async () => {
                  await api(`hotels/${hotelId}/requests/${r.id}`, { method: 'PATCH', body: { status: 'done' } });
                  drawRequests();
                },
              },
              icon('check'),
              t('requestDone'),
            )
          : null,
      );
    fill(body, 
      h('h2', null, `${t('openRequests')} (${open.length})`),
      open.length ? h('ul', { class: 'requests' }, open.map(item)) : h('p', { class: 'empty' }, t('noRequests')),
      done.length ? h('h2', null, t('doneRequests')) : null,
      done.length ? h('ul', { class: 'requests' }, done.map(item)) : null,
    );
    clearInterval(timer);
    timer = setInterval(() => tab === 'requests' && drawRequests(), 15000);
  }

  // --- Équipe (director) ---
  function drawTeam() {
    const err = errorBox();
    const form = h(
      'form',
      {
        class: 'card stack',
        onSubmit: async (e) => {
          e.preventDefault();
          try {
            await api(`hotels/${hotelId}/staff`, { method: 'POST', body: formData(form) });
            await load();
          } catch (ex) {
            showError(err, errText(ex));
          }
        },
      },
      h('h2', null, t('addStaff')),
      h('label', null, t('name'), h('input', { name: 'name', required: true })),
      h('label', null, t('username'), h('input', { name: 'username', autocapitalize: 'none', required: true })),
      h('label', null, t('password'), h('input', { name: 'password', type: 'text', minlength: 6, required: true })),
      err,
      h('button', { class: 'btn-big btn-primary', type: 'submit' }, icon('plus'), t('create')),
    );
    fill(body, 
      h(
        'ul',
        { class: 'list' },
        data.staff.map((s) =>
          h(
            'li',
            null,
            h('span', { class: 'with-icon' }, icon('user', 20), h('strong', null, s.name), ` (${s.username})`),
            h(
              'button',
              {
                class: 'btn-small btn-danger',
                onClick: async () => {
                  if (!confirm(t('confirmDelete'))) return;
                  await api(`hotels/${hotelId}/staff/${s.username}`, { method: 'DELETE' });
                  load();
                },
              },
              icon('trash', 18),
              t('delete'),
            ),
          ),
        ),
      ),
      form,
    );
  }

  // --- Réglages (director) ---
  function drawSettings() {
    const err = errorBox();
    const msg = h('p', { class: 'ok', hidden: true });
    const roomForm = h(
      'form',
      {
        class: 'card stack',
        onSubmit: async (e) => {
          e.preventDefault();
          const { numbers, floor } = formData(roomForm);
          try {
            const { created } = await api(`hotels/${hotelId}/rooms`, {
              method: 'POST',
              body: { numbers: parseRoomNumbers(numbers), floor },
            });
            await load();
            setTab('settings');
            const m = document.querySelector('.ok');
            if (m) {
              m.textContent = `${created.length} ${t('added')}`;
              m.hidden = false;
            }
          } catch (ex) {
            showError(err, errText(ex));
          }
        },
      },
      h('h2', null, t('addRooms')),
      h('label', null, t('roomNumbers'), h('input', { name: 'numbers', required: true, inputmode: 'numeric' })),
      h('label', null, t('floor'), h('input', { name: 'floor' })),
      err,
      msg,
      h('button', { class: 'btn-big btn-primary', type: 'submit' }, icon('plus'), t('create')),
    );

    const timing = h(
      'div',
      { class: 'card stack' },
      h('h2', null, t('timingMode')),
      h('p', null, t('timingHelp')),
      h(
        'button',
        {
          class: 'btn-big ' + (data.hotel.timingMode ? 'btn-success' : 'btn-neutral'),
          onClick: async () => {
            const { hotel } = await api(`hotels/${hotelId}`, {
              method: 'PATCH',
              body: { timingMode: !data.hotel.timingMode },
            });
            data.hotel = hotel;
            drawSettings();
          },
        },
        icon('clock'),
        data.hotel.timingMode ? t('on') : t('off'),
      ),
    );

    fill(body, 
      h('a', { href: `/h/${hotelId}/qr`, 'data-link': true, class: 'btn-big btn-tile' }, icon('printer'), t('printQr')),
      timing,
      roomForm,
      data.rooms.length ? h('h2', null, t('roomsList')) : null,
      h(
        'ul',
        { class: 'list' },
        data.rooms.map((r) =>
          h(
            'li',
            null,
            h('span', null, h('strong', null, r.number), ` · ${r.code}`),
            h(
              'button',
              {
                class: 'btn-small btn-danger',
                onClick: async () => {
                  if (!confirm(`${t('confirmDelete')} ${r.number}`)) return;
                  await api(`hotels/${hotelId}/rooms/${r.id}`, { method: 'DELETE' });
                  await load();
                  setTab('settings');
                },
              },
              icon('trash', 18),
              t('delete'),
            ),
          ),
        ),
      ),
    );
  }

  mount(topBar('…'), loading());
  await load();
  return () => clearInterval(timer);
}
