import QRCode from 'qrcode';
import { h, mount } from '../dom.js';
import { t, errText } from '../i18n/staff.js';
import { api } from '../api.js';
import { topBar, loading } from './common.js';

// Feuille imprimable : un QR par chambre.
export async function qrPage(hotelId) {
  mount(topBar('QR', { back: `/h/${hotelId}?tab=settings` }), loading());
  let data;
  try {
    data = await api(`hotels/${hotelId}`);
  } catch (e) {
    return mount(topBar('QR', { back: `/h/${hotelId}` }), h('p', { class: 'error' }, errText(e)));
  }
  const cards = await Promise.all(
    data.rooms.map(async (r) => {
      const url = `${location.origin}/r/${r.code}`;
      const src = await QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' });
      return h(
        'figure',
        { class: 'qr-card' },
        h('img', { src, alt: `QR ${r.number}` }),
        h('figcaption', null, h('strong', null, r.number), h('small', null, data.hotel.name), h('small', { class: 'mono' }, r.code)),
      );
    }),
  );
  mount(
    topBar(`QR · ${data.hotel.name}`, { back: `/h/${hotelId}?tab=settings` }),
    h(
      'section',
      { class: 'page' },
      h('p', { class: 'no-print' }, t('qrHelp')),
      h('button', { class: 'btn-big btn-primary no-print', onClick: () => window.print() }, t('print')),
      h('div', { class: 'qr-grid' }, cards),
    ),
  );
}
