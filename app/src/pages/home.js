import { h, mount, formData } from '../dom.js';
import { icon } from '../icons.js';
import { t, errText } from '../i18n/staff.js';
import { api, session } from '../api.js';
import { navigate } from '../main.js';
import { topBar, errorBox, showError, loading } from './common.js';

export async function homePage() {
  const user = session.user;
  // Le staff n'a qu'un hôtel : on l'y envoie directement.
  if (user?.role === 'staff' && user.hotelId) return navigate(`/h/${user.hotelId}`, true);

  mount(topBar(t('myHotels')), loading());
  let hotels = [];
  try {
    ({ hotels } = await api('hotels'));
  } catch (e) {
    if (e.status === 401) return navigate('/login', true);
    return mount(topBar(t('myHotels')), h('p', { class: 'error' }, errText(e)));
  }

  const err = errorBox();
  const form = h(
    'form',
    {
      class: 'card stack',
      onSubmit: async (e) => {
        e.preventDefault();
        try {
          const { hotel } = await api('hotels', { method: 'POST', body: formData(form) });
          navigate(`/h/${hotel.id}`);
        } catch (ex) {
          showError(err, errText(ex));
        }
      },
    },
    h('h2', null, t('newHotel')),
    h('label', null, t('hotelName'), h('input', { name: 'name', required: true, maxlength: 80 })),
    err,
    h('button', { class: 'btn-big btn-primary', type: 'submit' }, t('create')),
  );

  mount(
    topBar(t('myHotels')),
    h(
      'section',
      { class: 'page narrow stack' },
      hotels.map((ho) => h('a', { href: `/h/${ho.id}`, 'data-link': true, class: 'btn-big btn-tile' }, icon('building', 26), ho.name)),
      form,
    ),
  );
}
