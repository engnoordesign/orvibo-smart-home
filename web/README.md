# Digital Home website (ORVIBO)

The company website of Digital Home, exclusive ORVIBO distributor, with a separate admin panel.

**Sections, in order:** about Digital Home → ORVIBO and its advantages, with a comparison table →
lighting collection → colour quality (ORVIBO Ra 95+ against an ordinary light) → MixPad panels →
smart lock → curtains → climate & TV → phone control → more products → our work (projects) → contact.

Every product section has a live picture that changes as the visitor uses the controls: lights
fade and change colour, curtains slide, the TV plays, the AC blows, the door opens. In the colour
quality section the visitor drags a line across one still life to compare the two kinds of light, and
can switch on a "slow-motion camera" that shows flicker.

Arabic and English, light and dark mode, phones to desktops.

## Admin panel — `/admin.html`

Sign in with a username and password, then edit:

- brand, colours and the hero text
- About us, the ORVIBO text, advantages and the comparison table
- the colour-quality comparison (Ra values, labels, points)
- which sections show and in what order, and every section title
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
| `public/js/scenes.js` | The live pictures: room, front door, colour comparison |
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
