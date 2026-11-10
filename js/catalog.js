// Product catalogue used by the in-game configurator.
// Names follow the ORVIBO range; descriptions summarise what the simulator demonstrates.
// Please verify exact SKUs / specifications against the official price list before quoting.
export const CATALOG = {
  lock: {
    title: 'Smart Door Lock',
    blurb: 'Keyless entry by fingerprint, face, PIN, card or the app. Reports every opening, auto-locks and raises a tamper alarm after repeated failed attempts.',
    models: [
      { id: 'V5F', name: 'Smart Lock V5 Face', color: 0x2b2a2c, accent: 0xc9a25a, face: true, tall: 1.0, note: '3D face recognition, fingerprint, PIN, card, app, video doorbell' },
      { id: 'S2', name: 'Smart Door Lock S2', color: 0x1b1c1f, accent: 0x9aa0a8, face: false, tall: 0.85, note: 'Fingerprint, PIN, card, app' },
      { id: 'C1', name: 'Smart Door Lock C1', color: 0x4a4038, accent: 0xb87b4b, face: false, tall: 0.7, note: 'Compact fingerprint + PIN lock' },
    ],
  },
  mixpad: {
    title: 'MixPad Smart Control Panel',
    blurb: 'Wall-mounted touch panel and Zigbee gateway in one. Controls lighting, curtains, climate, music and security, runs scenes and shows the door camera.',
    models: [
      { id: '7U', name: 'MixPad 7 Ultra', w: 0.21, h: 0.125, color: 0x15161a, note: '7" flagship panel with voice control' },
      { id: 'X', name: 'MixPad X', w: 0.30, h: 0.19, color: 0x101114, note: '12.3" large-format home hub' },
      { id: 'S', name: 'MixPad S', w: 0.17, h: 0.105, color: 0x2c2d31, note: '6" panel with physical relay keys' },
      { id: 'M5', name: 'MixPad M5', w: 0.15, h: 0.095, color: 0x3a3b40, note: '5" multi-function panel' },
      { id: 'Mini', name: 'MixPad Mini', w: 0.12, h: 0.12, color: 0xdcd8d0, note: '4" compact panel, 86-box size' },
      { id: 'Genie', name: 'MixPad Genie', w: 0.12, h: 0.12, color: 0x6f6252, note: 'Voice-first mini panel' },
    ],
  },
  switch: {
    title: 'MixSwitch Smart Switch',
    blurb: 'Zigbee wall switch with back-lit keys. Each key can drive a load, a group of lamps or trigger a scene.',
    models: [
      { id: 'GR', name: 'MixSwitch — Space Grey', color: 0x54575c },
      { id: 'GD', name: 'MixSwitch — Champagne Gold', color: 0xbfa77c },
      { id: 'WH', name: 'MixSwitch — Pearl White', color: 0xecebe7 },
    ],
  },
  light_down: {
    title: 'SOPRO Smart Downlight',
    blurb: 'Dimmable, tunable-white recessed downlight (2700–6500 K) with smooth fade.',
    models: [
      { id: 'D-W', name: 'SOPRO Downlight — White trim', color: 0xf2f0ea },
      { id: 'D-B', name: 'SOPRO Downlight — Black anti-glare', color: 0x18181a },
    ],
  },
  light_spot: {
    title: 'SOPRO Smart Spotlight',
    blurb: 'Narrow-beam accent spotlight for artwork, shelves and reading zones. Dimmable and tunable.',
    models: [
      { id: 'S-B', name: 'SOPRO Spotlight — Black', color: 0x18181a },
      { id: 'S-W', name: 'SOPRO Spotlight — White', color: 0xf2f0ea },
      { id: 'S-M', name: 'SOPRO Magnetic Track Spot', color: 0x2a2a2e },
    ],
  },
  light_strip: {
    title: 'SOPRO Shadow-line Light Strip',
    blurb: 'Indirect RGB + tunable-white strip hidden in the ceiling shadow gap. 16 million colours, music-sync in Party mode.',
    models: [
      { id: 'T-RGBCW', name: 'SOPRO Strip RGB+CCT' },
      { id: 'T-CCT', name: 'SOPRO Strip Tunable White' },
    ],
  },
  curtain: {
    title: 'Smart Curtain Motor',
    blurb: 'Silent curtain motor with percentage control, touch-to-start and schedule support.',
    models: [
      { id: 'LIN', name: 'Smart Curtain Motor — Linen', color: 0xcfc6b6 },
      { id: 'SAG', name: 'Smart Curtain Motor — Sage', color: 0x8a9a86 },
      { id: 'CHA', name: 'Smart Curtain Motor — Charcoal', color: 0x4b4d52 },
    ],
  },
  presence: {
    title: 'Human Presence Sensor',
    blurb: 'Millimetre-wave sensor that detects people even when they sit still. Drives presence lighting, climate and away-mode security.',
    models: [{ id: 'MM', name: 'Human Presence Sensor (mmWave)' }, { id: 'PIR', name: 'Motion Sensor (PIR)' }],
  },
  climate: {
    title: 'Temperature & Humidity Sensor',
    blurb: 'Reports room temperature and humidity to trigger air-conditioning, ventilation and comfort automations.',
    models: [{ id: 'TH', name: 'Temperature & Humidity Sensor' }],
  },
  contact: {
    title: 'Door & Window Sensor',
    blurb: 'Magnetic contact sensor. Reports open/close instantly; triggers the alarm when armed and pauses the AC when a window is open.',
    models: [{ id: 'DW', name: 'Door & Window Sensor' }],
  },
  sos: {
    title: 'Emergency Button',
    blurb: 'One press sends an SOS to the family, lights the home, unlocks the door for responders and starts camera recording.',
    models: [{ id: 'SOS', name: 'Emergency (SOS) Button' }],
  },
  hazard: {
    title: 'Safety Sensor',
    blurb: 'Smoke, combustible-gas and water-leak detection linked to valves, ventilation, sirens and push notifications.',
    models: [{ id: 'HZ', name: 'Safety Sensor' }],
  },
  camera: {
    title: 'Smart Camera',
    blurb: 'Full-HD camera with motion recording, privacy mode and live view on the MixPad and the app.',
    models: [
      { id: 'PTZ', name: 'Smart Camera — Indoor PTZ', color: 0xf0f0ee },
      { id: 'BLT', name: 'Smart Camera — Outdoor Bullet', color: 0x2a2b2e },
    ],
  },
  speaker: {
    title: 'Smart Music System',
    blurb: 'Multi-room audio. The master host streams the music; slave ceiling speakers follow it in perfect sync or play independently per room.',
    models: [
      { id: 'CS', name: 'Smart Ceiling Speaker (Slave)', color: 0xf2f0ea },
      { id: 'CSB', name: 'Smart Ceiling Speaker — Black', color: 0x1c1c1f },
    ],
  },
  artist: {
    title: 'Artist Box',
    blurb: 'Master music host with hi-fi amplifier. Streams to every slave speaker and announces alarms through the whole home.',
    models: [
      { id: 'AB', name: 'Artist Box — Walnut', color: 0x5a3f2c },
      { id: 'ABK', name: 'Artist Box — Black', color: 0x18181a },
    ],
  },
  tv: {
    title: 'TV (IR / Smart Remote control)',
    blurb: 'The television joins scenes through the universal IR remote: Movie mode dims the lights, closes the curtains and switches the TV on.',
    models: [{ id: 'IR', name: 'Smart Remote (Magic Cube IR)' }],
  },
  ac: {
    title: 'Smart Air-Conditioning Control',
    blurb: 'VRF / split AC control: mode, set-point and fan speed, comfort automations and open-window energy saving.',
    models: [
      { id: 'VRF', name: 'VRF AC Controller' },
      { id: 'TS', name: 'Smart Thermostat Panel' },
    ],
  },
  relay: {
    title: 'Smart Relay / Valve Controller',
    blurb: 'Switches fans, valves and other fixed loads so they can join automations.',
    models: [{ id: 'RL', name: 'Smart Relay' }],
  },
};
export const modelOf = d => {
  const c = CATALOG[d.cat]; if (!c) return null;
  return c.models.find(m => m.id === d.model) || c.models[0];
};
