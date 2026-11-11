# Digital Home · ORVIBO Smart Home — website, live diagram and 3D simulator

A web app built for **Digital Home**, exclusive ORVIBO distributor. One page does three jobs:

1. **Product website** — the benefits of a smart home and a catalogue of every ORVIBO item with its
   advantages, models and specifications.
2. **Live 2D diagram** — the plan of the demo apartment with every device as an icon. Click to
   control anything, or customise which items are installed for a customer's order.
3. **3D simulation** — "Enter simulation" opens a first-person walk-through of the same apartment,
   in the same state you left the diagram in.

An **admin panel** edits the whole main page: texts, colours, sections and their order, benefits,
products, models, specifications, contact details and the simulator defaults.

No build step and no server code: it is a static site (HTML + ES modules + three.js, all vendored).

## Run it

Any static web server works, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. To publish it, enable **GitHub Pages** for the repository
(Settings → Pages → deploy from the `main` branch, root folder).

## Admin panel

Open it with the **Admin** link in the footer, or add `#admin` to the address. Default PIN: `1234`
(change it under Data).

| Tab | What it edits |
| --- | --- |
| General | Company name, tagline, accent colour, hero texts and buttons, contact details |
| Sections | Which sections appear on the main page, their titles and order |
| Benefits | The "why a smart home" cards |
| Products | Every product: description, advantages, specifications, models; add your own products |
| Simulator | Default graphics level, guided tour, time of day, season; link to the equipment editor |
| Data | Download / import the configuration, reset, change the PIN |

Edits are saved in the browser at once. To publish them for every visitor, use
**Data → Download site-config.json** and put that file next to `index.html` (replace the placeholder
in this repository). The file also carries the installed-equipment list from the diagram.

The PIN keeps casual visitors out of the panel; it is not real security, because this is a static
site with no server behind it.

## Controls (inside the simulation)

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

## Speed and stability

- The website loads without any 3D; graphics start only when the simulation is entered
- A fixed pool of real lights is shared among the ~35 light sources, so the drawing cost stays low and
  constant wherever you stand
- Static geometry is merged (about 350 meshes become about 60), cutting draw calls several-fold
- Low / Balanced / High adapt the render resolution to hold the frame rate; **Low** is the fastest
- The simulator recovers by itself if the browser resets the graphics context, and one bad frame can
  no longer freeze it
- Also available: ambient occlusion, bounced light and real mirrors (High), **Ultra 4K**, and a
  ray-traced photo mode (P) for stills

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/style.css` | Page shell; simulator HUD and app styling |
| `js/site.js`, `css/site.css` | Website, catalogue content and the admin panel |
| `site-config.json` | Published configuration (placeholder until you export your own) |
| `js/lights.js` | Light pool |
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

- Product names follow the ORVIBO range. Descriptions, advantages and specifications are starting
  content written for this demo, not taken from ORVIBO data sheets: check and correct them in the
  admin panel before customer use.
- The phone app follows the general layout of a smart-home app (home, rooms, device tiles, scenes,
  automation, security). It is not a copy of ORVIBO's own app artwork.
- ORVIBO, MixPad, MixSwitch and SOPRO are trademarks of their respective owner.

## Offline edition (no server needed)

The `standalone/` folder holds a single-file build: double-click
`ORVIBO Smart Home Simulator.html` to run it straight from disk. The two `Setup - Create Desktop Icon`
scripts add a desktop shortcut with the app icon on Windows, macOS or Linux.
