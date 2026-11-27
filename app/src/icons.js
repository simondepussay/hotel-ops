/**
 * Icônes de l'interface, à la place des emojis.
 * Même style que Clean Work : un trait de 1,8 px sur une grille de 24 × 24, couleur du texte,
 * dessinées à la main sans bibliothèque.
 */
const NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  // Navigation et actions générales
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  play: '<path d="M7.5 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5S9.7 5.9 12 3.5z"/>',
  logout: '<path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="7.5" rx="2"/><path d="M7 14h10v6H7z"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9.5 7V4.5h5V7"/>',
  send: '<path d="M4 12l16-7.5-5.5 15-3-6.5z"/><path d="M11.5 13L20 4.5"/>',
  user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/>',
  users: '<circle cx="9" cy="9" r="3.5"/><path d="M3 19.5c.9-3 3.2-4.5 6-4.5s5.1 1.5 6 4.5"/><path d="M15.5 5.6a3.5 3.5 0 0 1 0 6.8M17.5 15.2c1.6.6 2.8 2 3.5 4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>',
  building: '<path d="M4.5 20.5h15M6.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 17.5 5v15.5"/><path d="M9.5 7.5h1.5M13 7.5h1.5M9.5 11h1.5M13 11h1.5M9.5 14.5h1.5M13 14.5h1.5M11 20.5v-3h2v3"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  inbox: '<path d="M4 13.5l2.2-8A1.5 1.5 0 0 1 7.6 4.5h8.8a1.5 1.5 0 0 1 1.4 1l2.2 8V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',

  // États d'une chambre
  todo: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 15.8v.2"/>',
  cleaning: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5.5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5.5-4 8.5s4 4.5 4 8.5"/>',
  done: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9.5"/>',

  // Séjour du client
  bell: '<path d="M4 17.5h16M5.5 17.5a6.5 6.5 0 0 1 13 0M12 8.5V6.5M10.5 6.5h3"/><path d="M3.5 20.5h17"/>',
  door: '<path d="M6 20.5V4.5A1 1 0 0 1 7 3.5h8.5a1 1 0 0 1 1 1v16M4 20.5h16"/><path d="M13.5 12.5v.2"/><path d="M16.5 8.5h3M18 7l1.5 1.5L18 10"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"/>',

  // Catégories de commentaires
  broom: '<path d="M15.5 3.5L11 11"/><path d="M8.5 10l5 3-1.6 3.6a2 2 0 0 1-1.5 1.1L4 18.5l1.5-5.3a2 2 0 0 1 1.2-1.3z"/><path d="M7 15l1.5-1M9.5 16.5L11 15"/>',
  cup: '<path d="M6 7.5h11l-1.3 12a1.5 1.5 0 0 1-1.5 1.3H8.8a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M5.5 7.5h12M11.5 7.5l1.5-4h3"/>',
  bed: '<path d="M3.5 18.5V6M3.5 15h17v3.5M20.5 15v-2.5a2.5 2.5 0 0 0-2.5-2.5h-7.5V15"/><circle cx="7" cy="11.5" r="1.8"/>',

  // Demandes du client
  towel: '<path d="M3.5 4.5h17M5 3.5v2M19 3.5v2"/><path d="M6.5 4.5v12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-12"/><path d="M6.5 13.5h11M9 18v2.5M12 18v2.5M15 18v2.5"/>',
  sparkle: '<path d="M10 3.5l1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z"/><path d="M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  bottle: '<path d="M10 3.5h4M12 3.5v3"/><path d="M9.5 6.5h5l.5 2.5c1.3.6 2 1.8 2 3.2v6.8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19v-6.8c0-1.4.7-2.6 2-3.2z"/><path d="M7 13.5h10"/>',
  wrench: '<path d="M14.5 4a4.5 4.5 0 0 0-4.2 6.1L4.5 15.9a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8A4.5 4.5 0 0 0 19 8.5l-2.7 2.7-2.6-.7-.7-2.6L15.7 5.2A4.5 4.5 0 0 0 14.5 4z"/>',
  chat: '<path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.4A7.5 7.5 0 1 1 20 12z"/>',

  // Difficulté du ménage
  easy: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5v.5M15 9.5v.5"/>',
  normal: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5h7M9 9.5v.5M15 9.5v.5"/>',
  hard: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 16a4 4 0 0 1 7 0M9 9.5v.5M15 9.5v.5"/>',
};

export function icon(name, size = 22) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name] || ''; // chaînes fixes définies ci-dessus, jamais de données utilisateur
  return svg;
}
