import { loginPage } from './pages/login.js';
import { homePage } from './pages/home.js';
import { hotelPage } from './pages/hotel.js';
import { qrPage } from './pages/qr.js';
import { roomPage } from './pages/room.js';
import { session } from './api.js';

const routes = [
  [/^\/$/, () => (session.token ? homePage() : navigate('/login', true))],
  [/^\/login$/, () => loginPage()],
  [/^\/h\/([^/]+)$/, (id) => (session.token ? hotelPage(id) : navigate('/login', true))],
  [/^\/h\/([^/]+)\/qr$/, (id) => (session.token ? qrPage(id) : navigate('/login', true))],
  [/^\/r\/([A-Za-z0-9]+)$/, (code) => roomPage(code.toUpperCase())],
];

let stopCurrent = null;

// Une page peut renvoyer une fonction de nettoyage (ex : arrêter un minuteur).
export function render() {
  if (typeof stopCurrent === 'function') stopCurrent();
  stopCurrent = null;
  const path = location.pathname;
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      const r = fn(...m.slice(1));
      Promise.resolve(r).then((stop) => (stopCurrent = stop));
      return;
    }
  }
  navigate('/', true);
}

export function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  render();
}

// Les liens internes <a data-link> ne rechargent pas la page.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (a && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    navigate(a.getAttribute('href'));
  }
});
window.addEventListener('popstate', render);
render();
