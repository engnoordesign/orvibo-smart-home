// One line-icon set for the site and the admin panel (24×24, drawn with strokes).
const P = {
  plan: 'M4 4h16v16H4zM4 10h7v10M11 4v6M15 14h5', box: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10', tools: 'M14 6l4-4 4 4-4 4zM12 8L3 17l4 4 9-9M7 13l4 4',
  support: 'M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 13h4v6H6a2 2 0 0 1-2-2z', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18', wireless: 'M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 19h.01M2 9.5a14 14 0 0 1 20 0',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l8-8', design: 'M12 3l9 9-9 9-9-9zM12 8v8M8 12h8',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z', spot: 'M12 3v4M8 7h8l2 6H6zM8 17l-2 4M12 17v4M16 17l2 4',
  strip: 'M3 8h18M3 16h18M6 8v8M10 8v8M14 8v8M18 8v8', track: 'M3 5h18M7 5v4l-2 4h4l-2-4M17 5v4l-2 4h4l-2-4', pendant: 'M12 2v8M7 15a5 5 0 0 1 10 0zM10 18h4',
  washer: 'M4 20h16M6 20V9M10 20V6M14 20V6M18 20V9', panel: 'M3 5h18v14H3zM7 15h4M7 11h10', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  curtain: 'M3 4h18M6 4v16M18 4v16M6 4c3 5 3 11 0 16M18 4c-3 5-3 11 0 16', ac: 'M3 5h18v8H3zM7 17c0 2 2 2 2 4M12 17c0 2 2 2 2 4M17 17c0 2-2 2-2 4', tv: 'M3 5h18v12H3zM8 21h8',
  remote: 'M7 2h10v20H7zM12 6v.01M10 11h4M10 14h4M10 17h4', phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 19h2',
  switch: 'M5 3h14v18H5zM12 7v5', presence: 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10', thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z',
  contact: 'M4 3h7v18H4zM14 8h6v8h-6z', flame: 'M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-6 1 2 2 3 3 3 0-3-1-5 0-7z', camera: 'M3 7h13v10H3zM16 11l5-3v8l-5-3',
  sos: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v6M12 16.5v.5', home: 'M3 11l9-7 9 7M5 10v10h14V10', door: 'M5 21V3h11v18M16 21h3M13 12h.5', film: 'M3 5h18v14H3zM7 5v14M17 5v14',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  power: 'M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0', plate: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14M2 5v6M4 5v6M3 11v9M21 4v16', party: 'M4 20l5-14 9 9zM14 4l1 2M19 5l-2 1M20 10l-2-.5',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7', chat: 'M4 20l2-5a8 8 0 1 1 3 3z', clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21a8 8 0 0 1 16 0',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9h.01', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6',
  plus: 'M12 5v14M5 12h14', save: 'M5 3h11l3 3v15H5zM8 3v5h8V3M8 14h8v7H8z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  fan: 'M12 10c-1-4 1-7 3-6s1 5-3 6zM14 12c4-1 7 1 6 3s-5 1-6-3zM12 14c1 4-1 7-3 6s-1-5 3-6zM10 12c-4 1-7-1-6-3s5-1 6 3z', fp: 'M7 11a5 5 0 0 1 10 0v2M9 13v-2a3 3 0 0 1 6 0v4M12 11v6M7 15v1M17 16a6 6 0 0 1-1 3',
  card: 'M3 6h18v12H3zM3 10h18', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', key: 'M8 15a4 4 0 1 1 3-6.7L21 8v4h-3v3h-3l-1.5-1.5', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
};
export function sprite() {
  if (document.getElementById('dh-icons')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.id = 'dh-icons'; s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  s.innerHTML = Object.entries(P).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`).join('');
  document.body.prepend(s);
}
export const icon = (id, cls = 'ic') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const ICON_NAMES = Object.keys(P);
