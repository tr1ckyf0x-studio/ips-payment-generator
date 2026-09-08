# Nalog za uplatu

Browser-only generator for the Serbian payment slip *nalog za uplatu* (Obrazac br. 1).
Fill the form, get an A4 PDF with the slips at their true 210 × 99 mm, three to a sheet,
each carrying an NBS IPS QR code.

Everything runs in the browser. There is no backend, and no payment details ever leave
the device.

<https://ips.tr1ckyf0x.dev>

## What it does

- Draws the blank itself, so it prints on plain paper — no pre-printed NCR stock needed.
- Two blank variants: **OPTIMUM d.o.o.** (measured from real slips) and **HSFormular**.
- **IPS QR** per the National Bank specification, validated before it is drawn — a slip
  that cannot make a valid payload prints without a code and the form says why.
- Interface in Russian, Serbian and English, picked from the browser and remembered.
- Long values are scaled down rather than allowed to overrun a field.

## Development

Requires Node 22 and [poppler](https://poppler.freedesktop.org) (`pdftocairo`,
`pdftotext`, `pdftoppm`) — the tests render PDFs and measure them back.

```bash
brew install poppler      # macOS; apt-get install poppler-utils on Debian
npm install
npm run dev
```

The reference PDFs under `references/` are stored in Git LFS. Building, testing and
running the app do **not** need them — only `npm run fixture`, which re-measures the
blank, does. Fetch them when you need it:

```bash
git lfs pull
```

The application's own fonts are ordinary git objects, precisely so that a build never
depends on LFS. They are subset to the characters the app can actually print — 94 KB
instead of 1.3 MB — and `tests/fonts.spec.ts` fails if the blank ever asks for a
character that was cut.

| Command | Purpose |
|---|---|
| `npm test` | Full suite: geometry against the reference, rendered output against the layout, QR decoded off the page |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run visual` | Sample PDF plus a per-label position report against the reference |
| `npm run fonts` | Renders the same slip in each candidate face for comparison (downloads the rejected faces on first run) |
| `npm run fixture` | Re-snapshots the reference geometry — adopting a new reference, not a way to fix a failing test |
| `npm run ips:verify` | Checks IPS payloads against the National Bank's live validator (network; rate-limited) |
| `npm run fonts:subset` | Re-cuts the bundled fonts to the characters the app can print (fetches the originals) |

`CLAUDE.md` explains the design decisions and the measurements behind them;
`docs/specs/` holds the full spec.

## Deployment

Pushing a tag of the form `x.y.z` builds and publishes to Cloudflare Workers. The tag
must match `version` in `package.json`, or the workflow stops.

```bash
npm version 1.0.0 --no-git-tag-version   # bump, commit
git tag 1.0.0 && git push origin 1.0.0
```

Pull requests run the same typecheck, tests and build.

`wrangler.toml` holds everything about the deployment: the project name, the assets
directory and the custom domain. The Worker and its DNS record are created on the first
deploy, so nothing has to be set up in the dashboard by hand.

### One-time setup

Repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs:

| Scope | Permission | Why |
|---|---|---|
| Account | Workers Scripts: Edit | create and deploy the Worker |
| Zone (`tr1ckyf0x.dev`) | Workers Routes: Edit | attach the custom domain |
| Zone (`tr1ckyf0x.dev`) | DNS: Edit | create the record for it |

The scopes are two separate policies, and the split matters: `wrangler deploy` uploads
through `/accounts/{id}/workers/…`, so a `Workers Scripts` permission granted on the zone
rather than on the account fails with `Authentication error [code: 10000]` — a token that
otherwise authenticates fine and can read the account name.

Dropping the two zone permissions still deploys — the Worker just will not claim
`ips.tr1ckyf0x.dev`, and the domain has to be attached in the dashboard instead.

## Licence

The blank's geometry is measured from public sources; see `references/` and the notes in
`docs/specs/`. Bundled fonts keep their own licences:
[Liberation Sans](src/assets/fonts/LICENSE) (SIL OFL) and
[Roboto Condensed](src/assets/fonts/LICENSE-Roboto.txt) (Apache 2.0).
