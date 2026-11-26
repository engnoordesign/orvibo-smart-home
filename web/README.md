# Digital Home website (ORVIBO)

The company website of Digital Home, exclusive ORVIBO distributor, with a separate admin panel.

**Sections, in order:** about Digital Home → ORVIBO and its advantages, with a comparison table →
lighting collection → colour quality (ORVIBO Ra 95+ against an ordinary light) → MixPad panels →
smart lock → curtains → climate & TV → phone control → more products → our work (projects) → contact.

Every product section is a **real photo of a real room, relit live** as the visitor uses the controls:
lamps and LED lines fade and change colour, night falls, curtains slide across the window, the TV
plays, the AC blows air and the room cools, the front door swings open onto the street. Curtains, TV
screens and the AC follow the angle of the wall in the photo and pass behind the furniture in front of
them; lights fade, the motor speeds up and slows down, and dusk falls gradually. The controls sit
beside the photo (just below it on phones), so the picture and its controls move together and every
change is seen as it happens. Tapping a lamp, the AC, the TV or the curtain in
the photo works too. In the colour quality section the visitor drags a line across a real still life
to compare ORVIBO light with an ordinary one, and can switch on a "slow-motion camera" that shows
flicker.

The ORVIBO devices are shown with their **official product photos** from ORVIBO's global website
(`public/img/products/`): the MixPad 12, 7 and 4 panels (with the live screen laid on the real glass),
the V5 and C1 smart locks (the inside of the lock is fitted on the door in the photo, the outside is
the touchable keypad), SOPRO and Gauss lights, the G1 curtain motor, TS41 thermostat, Magic Dot IR
controller, MixSwitch, MixSense S361 and the sensors, camera and button. Track lights, LED strips,
pendants and wall washers have no photo on ORVIBO's site and keep a drawing; upload a photo for any
product in the admin panel and it replaces the default everywhere.

Arabic and English, light and dark mode, phones to desktops.

## Admin panel — `/admin.html`

Sign in with a username and password, then edit:

- brand, colours and the hero text
- About us, the ORVIBO text, advantages and the comparison table
- the colour-quality comparison (Ra values, labels, points)
- which sections show and in what order, and every section title
- **scene photos**: replace the photo of any scene with one from your own projects, then click on it to
  place the lamps (and where their light lands), LED lines, windows with curtains, the TV, the AC, the
  door, the lock and wall screens; drag the markers to adjust them, and drag the four corners of a
  window, TV or AC to match the angle of the wall
- products: add, edit, hide, delete or reorder; name, description and specifications in both
  languages, a photo, and where the product appears in the live scenes
- our work: projects with location, type, year, description, devices used and photos
- contact details
- the admin username and password
- backup (download / restore the content) and reset to defaults

Press **Save** to publish the changes.

## Deploy on Cloudflare Workers

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → choose this
   repository. In the build settings set **Root directory** to `web` and keep the deploy command
   `npx wrangler deploy`. Deploy.
2. The content storage (a KV namespace bound as `CONTENT`) is created automatically on the first
   deploy.
3. Open the Worker → **Settings → Variables and Secrets** and add two **secrets**:
   `ADMIN_USER` and `ADMIN_PASSWORD` (at least 8 characters). Redeploy if asked.
4. Go to `https://<your-worker>.workers.dev/admin.html` and sign in.

After the first sign-in you can change the username and password from **Account**; the new ones
are stored hashed in KV and take over from the secrets.

From a computer with Node.js instead:

```bash
cd web
npx wrangler deploy
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASSWORD
```

## How it is built

| Path | Purpose |
| --- | --- |
| `public/index.html`, `public/js/site.js` | The website |
| `public/js/photo.js` | The live photo scenes: relighting, curtains, TV, AC, door, colour comparison |
| `public/js/devices.js` | Drawings of the ORVIBO devices, used when no product photo is uploaded |
| `public/img/` | The default room photos |
| `public/js/content.js` | Default content (Arabic and English) |
| `public/js/store.js` | Loads and saves content, photos and the admin sign-in |
| `public/admin.html`, `public/js/admin.js` | The admin panel |
| `src/worker.js` | Cloudflare Worker: content, photos, sign-in |
| `wrangler.jsonc` | Cloudflare configuration |

Security: passwords are stored as PBKDF2 hashes; the session is a signed, HTTP-only, SameSite
cookie that expires after 12 hours and is invalidated when the password changes; every change
request must carry a custom header; sign-in is locked for 15 minutes after 10 wrong attempts from the
same address.

Opened as plain files (without the Worker), the site still works in a preview mode: the admin
account and the edits are kept in that browser only.

## Notes

- Product descriptions and specifications are starting content written for this site, not copied
  from ORVIBO data sheets; check them in the admin panel before going live.
- The colour comparison is an illustration of the difference between high and ordinary colour
  rendering; the Ra values shown are editable.
- The three projects in "Our work" are marked as examples; replace them with real ones.
- The default room photos come from Pexels (free for commercial use, no attribution required). Replace
  them with photos of your own projects from **Scene photos** in the admin panel.
