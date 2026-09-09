# ips-payment-generator

Browser-only React app that generates print-ready A4 PDFs of the Serbian payment slip
"nalog za uplatu" (Obrazac br. 1), at true physical size, three slips to a sheet.

Design document: `docs/specs/2026-09-08-nalog-za-uplatu-design.md`.

## Rules

- Runs entirely in the browser. No backend, no server-side rendering.
- Discuss decisions before implementing them; argue when a proposal is worse than the
  alternative, and offer the alternative.
- Keep this file current as decisions are made.

## The organising idea

**The layout is data, not code.** `src/layout/formSpec.ts` is a list of primitives with
millimetre coordinates; `src/pdf/renderer.ts` walks it and emits pdf-lib calls. This is
what makes the geometry testable: a layout test compares two arrays of numbers instead
of diffing images.

Consequences worth preserving:

- Blank variants are a Strategy — add a `FormProfile`, do not branch inside the renderer.
- A second output backend would be a Bridge over the same spec.
- Millimetres everywhere. Points appear only inside `renderer.ts`, in `mm()` and
  `place()`. `place()` is also the only place where our top-left origin becomes
  pdf-lib's bottom-left one.

## Two blanks

`src/layout/blankGeometry.ts` holds what every blank shares — wording, type sizes, how
captions sit relative to their rules — and `createProfile()` turns a `BlankGeometry`
into a drawable `FormProfile`. `src/layout/formSpec.ts` holds the two sets of numbers.

- **`pausal`** — from `references/reference-uplatnica-pausal.pdf`, vector and exact.
  Measured by `tools/extractGeometry.ts`, frozen into
  `tests/fixtures/reference-geometry.json`, held to 0.25 mm by `tests/layout.spec.ts`.
- **`optimum`** (default) — the blank printed by OPTIMUM d.o.o., measured from nine
  scans by `tools/measure_blank.py`, and placed on the sheet by a card-calibrated
  flatbed scan. Blocks 90.9 x 15.1 mm against the reference's 89.75 x 13.96, pitch 21.2
  against 19.45, separator 7.0 mm past the blocks against 6.0.

Scale for the OPTIMUM figures is absolute — from each scan's own page size, not relative
to the other blank — and the key figures agree across all nine scans. What the scans
cannot give is the origin: all are cropped. That came later, from a flatbed scan with a
bank card in the frame — see "Where the arrangement sits on the sheet".

Measuring the scans needed two things earlier attempts got wrong: the rules are printed
pale, so run-length detection tuned for text misses them entirely (read a brightness
profile down a clean column instead), and the framed fields must be found by unbroken
runs tens of millimetres long, since characters inside them break into runs of one or two.

`tests/profiles.spec.ts` checks both blanks for what no reference can supply: that
everything fits the sheet, that the QR collides with nothing, that every field has a
slot, and that the QR is decodable off the rendered page.

## Typography

Two faces, because a real slip uses two:

- **Liberation Sans** for the blank's own wording (Arial-metric, as the reference).
  Sizes 8 pt labels, 13.4 pt title, 6.85 pt footer, solved by fitting rendered widths
  to the reference until every label reads 100.0 %.
- **Roboto Condensed** for the data. Machine-filled slips use a condensed face:
  measured on the OPTIMUM scans at 76.7 % of Arial's width for the same cap height,
  ~81 % once ink spread is allowed for, i.e. Arial Narrow. Base size 10 pt, at which
  "PETAR PETROVIĆ" comes out the 31.9 mm the scan shows.

  The title is **bold and flush right** (`anchorRight`), as on the OPTIMUM blanks:
  45.1 mm wide, 3.52 mm capitals, stroke 0.178 of the cap height. The pausal reference
  sets it regular, and following that made it look thin.

## Centring values

A framed field's value is centred in it on both axes. Vertical centring is resolved in
the renderer, not the layout, because it needs the cap height of the face actually used
and the size after any shrinking: the middle of the capitals goes on the middle of the
field. Centring the baseline or the full ascender-to-descender box both sit visibly low.
`tests/values.spec.ts` checks the result on the rendered ink, and was verified to fail
when the old baseline-fraction behaviour is restored.

## Bundled fonts

The three faces are **subset** to what the app can print: 94 KB against 1.3 MB full.
The two that draw the blank keep only its wording (56 characters); the one that draws
values keeps Latin, Serbian diacritics and Cyrillic, since a value is printed verbatim
even though the QR payload transliterates it.

`npm run fonts:subset` re-cuts them, always **from freshly fetched originals** — running
it over the repository's own copy would cut a subset out of a subset and lose characters
irrecoverably. `tests/fonts.spec.ts` checks coverage: a missing glyph does not throw, it
just prints nothing, so nothing else would catch it.

## The PDF pipeline is deferred

Nothing that makes a PDF is needed to paint the form, so none of it is in the first load.
The entry chunk is **300.8 kB** (97.5 kB gzip) against 1687 kB when everything was
static:

| chunk | kB | gzip | fetched |
|---|---:|---:|---|
| `index` | 300.8 | 97.5 | on load |
| `pdf` (pdf.js) | 365.1 | 107.6 | when there is a document to show |
| `renderer` (pdf-lib, fontkit, qrcode) | 1058.2 | 428.8 | on the first render |
| `pdf.worker` | 1375.8 | — | by pdf.js itself |

Two cuts, both `import()` rather than `React.lazy`:

- `usePdfDocument` imports the renderer inside its debounced effect, which was already
  asynchronous and already had a pending state, so deferring cost no machinery.
- `PdfPreview` imports pdf.js inside its effect and caches the promise at module scope.
  The component, its heading and its styles stay in the entry chunk, so the pane is
  never an empty frame while the library arrives — the heading already says "updating".

`tests/bundle.spec.ts` holds the entry chunk under 450 kB. That guard is what keeps the
split from quietly reverting: a static import of the renderer puts it back to 1344 kB,
and nothing else would notice. It was verified to fail that way.

The build must be run in production mode to measure this. vitest sets `NODE_ENV=test`,
vite carries that into the bundle, and React's development build is 200 kB that never
ships — enough to make a size ceiling meaningless.

## The standard PDF fonts are stubbed out

`@pdf-lib/standard-fonts` carries the AFM metrics of the fourteen fonts every reader
already has, and cost 127 kB of the bundle — 7 % — for data this app never reads: the
blank must print identically everywhere, so all three faces are embedded. It arrives
because `pdf-lib/utils/objects` evaluates `values(FontNames)` at module scope, which
pulls in `Font.js` and its fourteen compressed JSON files. Tree shaking cannot see past
that.

`vite.config.ts` aliases the package to `src/pdf/standardFonts.ts`, which keeps
`FontNames` and the encoding tables real and replaces only `Font.load` with a throw.
The alias is anchored (`/^@pdf-lib\/standard-fonts$/`) because a bare string alias also
rewrites deep paths, and the stub imports one to keep the encoding tables.

**The guard is on the artifact, not the module graph.** vitest loads `pdf-lib` from its
CommonJS build, outside vite's transform, so the alias never reaches it in a test — a
test importing `pdf-lib` gets the real package and would pass either way.
`tests/bundle.spec.ts` builds and looks for the compressed AFM payloads instead: each
font is a zlib stream in base64, so a long run beginning `eJy` is font data and nothing
else. Twelve before the alias, none after; verified to fail when the alias is removed.

Anyone calling `embedStandardFont` now gets an exception naming the cause, which beats a
slip typeset in metrics the layout was never calibrated against.

## Fitting long values

Fields cannot grow, so `src/layout/fitText.ts` scales a value down until its widest
line fits. Text width is linear in point size, so the fitting size is one division, not
a search. All lines of a field share one size, or a block would show lines of different
heights.

`renderDocument` returns `{ bytes, shrunk }`; the form warns only when a field fell
below `LEGIBLE_SIZE_PT`, so ordinary shrinking stays silent. Nothing is ever truncated —
losing part of an account number or purpose would be worse than small type.

**Vertical placement is calibrated on the raster, never on `pdftotext -bbox`.** The
reference does not embed its Arial, so poppler substitutes a face and reports that
substitute's metrics; matching those boxes put every label 0.5 mm low and dropped the
tail of "платилац" onto the rule below it. `tools/inkMetrics.ts` measures where ink
actually falls, which is comparable across PDFs.

**Labels above rules are placed by clearance, not by the reference's coordinate.** The
reference crowds them to 0.05-0.20 mm; the OPTIMUM blanks leave 1.19-1.32 mm. We follow
the real blank via `LABEL_CLEARANCE`, and such labels carry `anchoredAbove` so the
divergence reads as a decision rather than a bug.

Regenerating the fixture (`npm run fixture`) means adopting a new reference. It is not
a way to make a failing test pass.

## Verification

```bash
npm test      # layout vs reference, render vs layout, values, pagination
npm run visual # sample PDF + per-label position report against the reference
python3 tools/scan_crosscheck.py references/scans/optimum-2026-09-04.pdf
```

The chain is: spec is checked against the reference blank, and the generated PDF is
parsed back with the same extractor and checked against the spec. A wrong coordinate
has to be wrong in both directions to reach paper.

## Sizes that matter

- Slip cell is the normative **99 mm**; three stack to exactly 297 mm, a full A4.
- Drawn content ends around 90 mm, so nothing is clipped by the slack.
- Content spans 8.98 to 199.44 mm horizontally, clearing the Epson EcoTank L3280's
  3 mm minimum margin.
- Print at **100 % / Actual size**. "Fit to page" silently rescales and the slip stops
  being 210 x 99 mm.

## Conventions

- String-literal constants via `as const` objects, not `enum`.
- `@types/node` tracks the **runtime**, not npm's latest. The types describe APIs that
  have to exist when the code runs, so they follow the `engines` field — today Node 24,
  the active LTS. `npm outdated` will keep offering a newer major; that is expected, and
  taking it would be describing a Node we do not run on.
- The šifra plaćanja is stored as its two halves (`oblikPlacanja`, `osnovPlacanja`) and
  joined by `sifraPlacanja()`. Storing the joined code made either half unselectable
  until the other was set; `tests/slip.spec.ts` guards against a regression.
- `references/scans/` is git-ignored: those are real payment slips with personal data.
- Reference PDFs are in Git LFS; the application's own fonts are not. Nothing the build or the tests read comes from LFS, so CI checks out without it —
  otherwise every routine build would draw on the free LFS bandwidth. Verified by running
  the suite on a checkout with `GIT_LFS_SKIP_SMUDGE=1`.
- The payer's details are the one thing kept between visits
  (`src/storage/payerDetails.ts`, one `localStorage` key). The store takes its `Storage`
  by argument so it can be tested without a browser, and guards every access: Safari's
  private mode and blocked site data both throw, and a form that crashed there would be
  worse than one that forgets. Nothing else is persisted — a slip is a one-off document.
- "место и датум пријема" and "датум извршења" are filled in by the bank at payment
  time, so they are neither form fields nor model fields — but their rules and wording
  are still drawn. `tests/values.spec.ts` guards both halves of that.

## IPS QR

Payload per `references/ips/nbs-preporuke-validacija.pdf`, built in `src/ips/payload.ts`.
Drawn as vector rectangles (runs of dark modules merged) at 30 x 30 mm in the lower-right
quadrant — the only free space on a blank that predates instant payments.

**Two rules are not in the written recommendations and were found by probing the NBS
validator:**

- Text fields reject Cyrillic (`N:ЈП ЕПС БЕОГРАД` returns 608) while Serbian Latin with
  diacritics passes. We transliterate rather than refuse — the two scripts are officially
  equivalent in Serbia.
- Model 97 references are checked for their ISO 7064 MOD 97-10 check digits. A wrong
  reference is refused locally, since the bank would refuse the code anyway.

`npm run ips:verify` re-runs that probe against the live validator (13 cases, all
accepted). It is a script, not a test: it needs the network and the service rate-limits.
It only ever sends the sample account from the NBS documentation.

**Error correction is L**, matching the NBS generator's own — probing showed a 90-byte
payload coming back as version 5, which at M holds only 84 bytes. A stronger level costs
nothing in compatibility but packs more modules into the same square, and a module too
small to resolve fails outright rather than degrading. At L a filled slip sits at
0.61 mm per module and the payer tag fits; at H the same slip needs version 12 and drops
to 0.46 mm, with the payer tag pushing it to 0.41 mm.

Both are configurable: `renderDocument(..., { ips: { level, includePayer } })`.

## hitno

The "način izvršenja - hitno" box exists on the OPTIMUM blanks but not on the pausal
reference, which predates the 65/2018 amendment. Measured off the scans at
`x 178.04, w 5.15, h 4.1`, its lower edge on the "датум извршења" rule; two scans agree
to 0.07 mm. Prilog 2 says the letter **H** goes in it, and a slip carrying H for up to
300,000 dinars must be executed as an instant transfer.

Its box carries `beyondReference: true` so the layout tests can tell a deliberate
addition from a drift against the reference.

**It also forced the QR to move.** The QR had been placed before this element was
measured, and the two overlapped — the outline landed inside the symbol. It was given a
coordinate clear of the box, and `tests/ips.spec.ts` asserts it overlaps no primitive at
all.

**That coordinate then went stale, so the QR's `y` is now derived.** Sitting where it was
first put, the symbol had 0.5 mm of air above it and 7.2 mm below on the OPTIMUM blank:
clear of everything, but reading as crowding "позив на број" rather than occupying the
gap. `qrArea()` in `blankGeometry.ts` centres it in the band between the bottom of that
field and the top of the hitno box, so neither neighbour can move without taking the QR
with it. `BlankGeometry.qr` therefore declares only `x` and `size`; the band gives the
rest — 3.9 mm each side on OPTIMUM, 1.4 mm on the tighter pausal reference.
`tests/profiles.spec.ts` holds both blanks to it, and was verified to fail on the old
placement.

## Where the arrangement sits on the sheet

The nine photographs gave proportions but never the **origin** — all were cropped, so
the left margin was a guess at 5.5 mm. A flatbed scan holding the slip and a bank card
in one frame settled it: the whole printed layout sits **0.77 mm further right** than
that guess, and the left block is 0.2 mm wider.

Measured, against profile: blocks x0 6.24 (was 5.5), x1 97.16, separator 104.18, block
width 90.92. Eleven edges of the right column, from x 113 to x 204, agree on the same
0.73-0.86 mm shift, so it is a translation and not a scale error. Vertically the profile
was already right — block height 15.1 to 0.03 mm, pitch and tops within 0.35 mm.

**The length standard is the card, not the graph paper.** Graph paper looked like the
obvious ruler and is not one: measured against the card it is ruled 0.29 % long on one
axis and 0.20 % short on the other, and not uniformly across the sheet. That
anisotropy — and not the scanner, which came out isotropic to 0.007 % — is what had
made two graph-paper scans of the same slip disagree by half a millimetre. An ISO/IEC
7810 ID-1 card is 85.60 x 53.98 mm to +-0.13 and +-0.055, which is a tighter standard
than anything printed.

Two routes agree: card-only, and graph paper calibrated by a card in another frame.
Block width 90.91 against 90.93, pitch 21.08 against 21.08, sheet 209.57 x 96.59 against
209.86 x 96.61.

Two things worth knowing that fall out of it:

- **The physical slip is 96.6 mm tall, not 99.** Guillotining a three-up sheet costs
  about 2.4 mm. We print the normative 99 mm cell regardless; a cut slip will simply be
  a couple of millimetres taller than the print shop's.
- **This is one sheet.** Press registration drifts between runs, so the absolute origin
  carries whatever that particular sheet was cut and printed to. The proportions, which
  come from nine sheets, are the sturdier half.

## Deployment

Cloudflare **Workers** with static assets, not Pages: Cloudflare treats Pages as legacy,
and `wrangler deploy` creates the project itself, so a release needs no dashboard step.
`wrangler.toml` carries the project name, the assets directory and the custom domain, so
the workflow passes no arguments that could drift from it.

The first attempt did use Pages and failed with "The Pages project does not exist" —
that path requires creating the project by hand first.

## Git and releases

**One logical change, one commit**, the message a single line in the past tense. That
discipline is not bookkeeping: it is what makes `git bisect` land on states somebody
intended, and what lets the release notes be generated instead of written.

**History is rewritable until it is pushed, and immutable after.** Signing works by
amending, so every batch gets rewritten once between being committed and being pushed —
which is fine while it is local. Once on `origin` a commit stays. Breaking that rule cost
something real on 2026-09-09: rewriting already-published commits orphaned the deployment
records GitHub had made for them, and four of the five still point at commits that are no
longer on `main`.

**Work goes straight to `main`.** The suite runs locally before every push and there is
nobody else to review, so a pull request to oneself buys ceremony and no safety. Open a
branch when you want CI's verdict *before* the change lands — changes to the workflows
themselves are the clear case, since they cannot be exercised locally.

**There is no `CHANGELOG.md`.** It would duplicate the commit log, and a file that has to
be hand-edited on every change is the first thing forgotten and the first thing to
conflict. What a reader wants lives on the Releases page instead.

**Release notes are written, not generated.** Pasting the commit range would be cheap and
would read like one: commit messages say what was done to the code, while a release note
has to say what changed for someone printing slips. The commit log is the raw material —
which is what the one-line-past-tense rule is for — but the text is composed per release.

### What the version means

The contract is **the printed slip**, not an API — nobody pins this app, and the only
thing a user can be surprised by is paper coming out different.

| | when | example |
|---|---|---|
| MAJOR | the printed slip changes | blank geometry, a different default profile, the QR moving |
| MINOR | a new capability, existing output identical | another interface language, another blank variant, a new field |
| PATCH | fixes and internals, output byte-identical | a shrink-to-fit bug, a dependency bump, bundle work |

The geometry tests are the arbiter rather than judgement: **if a release had to change
`tests/layout.spec.ts`, `tests/values.spec.ts` or the reference fixture, it is MAJOR.**
Those tests exist precisely to notice when the paper moves.

### Cutting a release

The version in `package.json` and the tag must agree — `deploy.yml` stops if they do not,
because a build labelled with the wrong version is worse than no build.

```bash
npm version 0.2.0 --no-git-tag-version     # package.json only
git commit -am 'Released 0.2.0'
git commit --amend --no-edit -S            # tags and releases are signed
git push origin main
git tag -s 0.2.0 -m 0.2.0 && git push origin 0.2.0
```

Pushing the tag builds, tests and deploys to Cloudflare. The GitHub release is published
afterwards, by hand, once the deploy is green:

```bash
gh release create 0.2.0 --title 0.2.0 --notes-file <written notes> --verify-tag
```

Deliberately not a workflow step. A release published automatically could only carry the
commit list, and that is the thing this project decided not to ship.

### Still to do by hand, in the repository settings

The `production` environment exists — GitHub creates it from the `environment:` block in
`deploy.yml` — but carries no rules, and the Cloudflare credentials sit at repository
scope where every workflow can read them:

- a deployment tag policy on `production`, so only `[0-9]+.[0-9]+.[0-9]+` can deploy.
  Today that is enforced only by a shell step, which anyone editing the workflow can
  remove;
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` moved to environment secrets, so a
  token that can deploy is not readable by a workflow running on a pull request.

## Not done yet

- Overlay printing onto pre-printed NCR stock (`drawBlank: false` exists in the renderer
  but is unused and would need per-printer calibration).
