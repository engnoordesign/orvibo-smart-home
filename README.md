# Digital Home · ORVIBO Smart Living Simulator

A first-person, video-game-style web simulator of an apartment fully equipped with ORVIBO smart home
products, built for **Digital Home**, exclusive ORVIBO distributor. The visitor walks up to the door,
unlocks it with the smart lock and then controls the whole apartment by hand, from the MixPad wall
panels or from a phone app laid out like the ORVIBO Home app.

No build step and no server code: it is a static site (HTML + ES modules + three.js, all vendored).

## Run it

Any static web server works, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. To publish it, enable **GitHub Pages** for the repository
(Settings → Pages → deploy from the `main` branch, root folder).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows, Shift | Walk, run |
| Mouse | Look (click the view to capture the mouse) |
| E / left click | Use the device you are looking at |
| Q / right click | Inspect a device and choose its model |
| Tab | Phone app (docked on the right; you can keep walking and looking around) |
| F | Control Centre — 2D plan, full control, project customisation |
| C | Security cameras (click a tile for full screen) |
| P | Ray-traced photo of the current view |
| X | Disarm / silence the alarm |
| M, H, Esc | Mute, help, close a panel |

Touch devices get an on-screen joystick and buttons.

## The apartment

Living room, open kitchen, guest bedroom, master bedroom with en-suite bathroom, balcony and the
building corridor outside the entry door. 70 simulated devices as standard, and more can be added:

- **Smart lock** — fingerprint, face, PIN, card, one-time PIN, remote unlock, doorbell, auto-lock, tamper alarm after five failures
- **MixPad** panels (living room, master), a **MixPad X** home hub, and **MixSwitch** keys in every room, including scene keys
- **SOPRO lighting** — downlights, spotlights / track, pendants and RGB + tunable-white shadow-line strips, with brightness, colour temperature, colour and fade time
- **Sensors** — human presence in every room, outdoor motion on the balcony (perimeter warning), temperature & humidity, door / window contacts, emergency (SOS) buttons, smoke, gas and water-leak
- **Music** — Artist Box master with slave ceiling speakers, per-zone volume, whole-home sync, generated music
- **Climate** — three AC units with mode, set-point and fan speed acting on a simple thermal model
- **Curtain motors**, two TVs, bathroom exhaust fan, gas and water valves
- **Four cameras** — entrance, living room, balcony, kitchen — with live grid view, recording on alarm and picture-in-picture pop-up

## Control Centre (F)

A live 2D plan of the apartment with every device as an icon.

- **Control** — click a room or an icon to get its full controls; click a selected icon again to switch it.
  Whole-home shortcuts, scenes and arming sit in the top bar. "Walk there in 3D" jumps to the device.
- **Customise project** — build the apartment to a customer's order:
  - switch any item in or out (the lock always stays); a removed sensor really stops its automations
  - choose the installed model per item
  - add new items by clicking on the plan: presence / motion sensors, temperature & humidity, emergency
    button, smoke and leak sensors, cameras, MixPad, MixPad X, MixSwitch, ceiling speakers
    (wall items snap to the nearest wall)
  - start from a package: Full showcase, Essential, Security, Comfort & entertainment, Empty
  - bill of materials with CSV download, copy, and project export / import (JSON)
  - the project is saved in the browser automatically

## Cameras

Live pictures appear inside the app (Security tab and each camera's page), full screen with C, on the
MixPad when the doorbell rings, and on the living-room TV: pick the "Security cameras" channel, press
"Show on TV", or let the home do it — the TV switches to the cameras on an intrusion alarm and shows
the entrance camera when the doorbell rings while the TV is on.

## Scenes and automations

Scenes: Welcome Home, Leave Home, Movie Night, Dinner, Party, Good Night, Good Morning, Reading,
Romantic, All Off.

Built-in automations (each can be switched off; protection rules are always on): welcome on unlock,
presence lighting with a night path, comfort climate, open-window energy saving, bathroom
ventilation, sunset / sunrise curtains, doorbell, door left open, night auto-arm, intrusion response,
fire / gas / leak protection and the emergency button. Custom IF → THEN rules can be added in the app.

Security simulations (app → Security): balcony break-in, forced entry door, PIN guessing at the lock,
visitor at the doorbell, smoke, gas leak, water leak and SOS.

## Graphics

- Physically based materials, soft shadows, ambient occlusion, bloom, bounced light and real mirrors
- **Ultra 4K** quality renders at least 3840 pixels wide internally
- **Ray-traced photo mode (P)** — a progressive GPU path tracer renders the current view with global
  illumination; real-time hardware ray tracing is not available to web browsers, so this mode is for stills
- Low / Balanced (default) / High adapt the render resolution automatically to keep the frame rate smooth;
  the live frame rate is shown in the status box

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/style.css` | Page shell, HUD and app styling |
| `js/world.js` | Architecture, furniture, materials, sky |
| `js/devices.js` | Every device: model, state, hand interaction |
| `js/sim.js` | Scenes, automations, security, climate, energy |
| `js/actors.js` | Intruder / visitor scenarios, player avatar for the cameras |
| `js/ui.js` | Phone app, MixPad UI, lock keypad, inspector, CCTV, HUD, tour |
| `js/plan.js` | Control Centre: 2D plan, customisation, bill of materials |
| `tools/build-standalone.sh` | Rebuilds the single-file offline edition |
| `js/audio.js` | Generated music, sound effects, siren, voice |
| `js/catalog.js` | Product models offered by the configurator |
| `vendor/` | three.js, three-mesh-bvh, three-gpu-pathtracer (MIT licences included) |

## Notes

- Product names follow the ORVIBO range; model lists and descriptions in `js/catalog.js` are
  illustrative and should be checked against the current official catalogue before customer use.
- The phone app follows the general layout of a smart-home app (home, rooms, device tiles, scenes,
  automation, security). It is not a copy of ORVIBO's own app artwork.
- ORVIBO, MixPad, MixSwitch and SOPRO are trademarks of their respective owner.

## Offline edition (no server needed)

The `standalone/` folder holds a single-file build: double-click
`ORVIBO Smart Home Simulator.html` to run it straight from disk. The two `Setup - Create Desktop Icon`
scripts add a desktop shortcut with the app icon on Windows, macOS or Linux.
