import { h, mount, formData } from '../dom.js';
import { t, errText } from '../i18n/staff.js';
import { api, session } from '../api.js';
import { navigate, render } from '../main.js';
import { topBar, errorBox, showError } from './common.js';

let registerMode = false;

export function loginPage() {
  const err = errorBox();
  const next = new URLSearchParams(location.search).get('next');

  const form = h(
    'form',
    {
      class: 'card stack',
      onSubmit: async (e) => {
        e.preventDefault();
        showError(err, '');
        const data = formData(form);
        try {
          const res = await api(registerMode ? 'auth/register' : 'auth/login', { method: 'POST', body: data });
          session.save(res);
          navigate(next && next.startsWith('/') ? next : '/', true);
        } catch (ex) {
          showError(err, errText(ex));
        }
      },
    },
    h('label', null, t('username'), h('input', { name: 'username', autocomplete: 'username', autocapitalize: 'none', required: true })),
    h(
      'label',
      null,
      t('password'),
      h('input', {
        name: 'password',
        type: 'password',
        autocomplete: registerMode ? 'new-password' : 'current-password',
        minlength: registerMode ? 8 : null,
        required: true,
      }),
    ),
    registerMode ? h('label', null, t('name'), h('input', { name: 'name', autocomplete: 'name' })) : null,
    err,
    h('button', { class: 'btn-big btn-primary', type: 'submit' }, registerMode ? t('register') : t('login')),
  );

  mount(
    topBar(t('appName')),
    h(
      'section',
      { class: 'page narrow' },
      form,
      h(
        'button',
        {
          class: 'btn-link',
          onClick: () => {
            registerMode = !registerMode;
            render();
          },
        },
        registerMode ? t('haveAccount') : t('register'),
      ),
    ),
  );
}
