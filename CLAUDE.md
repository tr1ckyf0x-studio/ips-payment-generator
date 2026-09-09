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
  scans by `tools/measure_blank.py`. Blocks 90.7 x 15.1 mm against the reference's
  89.75 x 13.96, pitch 21.2 against 19.45, separator 7.0 mm past the blocks against 6.0.

Scale for the OPTIMUM figures is absolute — from each scan's own page size, not relative
to the other blank — and the key figures agree across all nine scans. What the scans
cannot give is the origin: all are cropped, so where the arrangement sits on the sheet is
inferred from the least-cropped ones (5.5 mm left margin).

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
measured, and the two overlapped — the outline landed inside the symbol. The QR is now
26 mm at `173.44, 48.5`, which is what the 28.8 mm of clear height between the framed
fields and the hitno box allows. `tests/ips.spec.ts` now asserts the QR overlaps no
primitive at all.

## What the scans still cannot pin down

`optimumProfile` reproduces the scans' proportions — the two blanks really do differ,
the pausal reference being 6 % shorter in the block — and `tests/profiles.spec.ts`
holds it to the measured figures. What no scan can supply is the **origin**: every one
is cropped by the camera, so where the arrangement sits on the 210 x 99 mm sheet is
inferred from the least-cropped ones, at a 5.5 mm left margin.

That is the residual. `tools/scan_crosscheck.py` compares the one scale-free quantity a
photograph can carry — the separator's position as a fraction of the block width — and
reads +1.1 %, about 1 mm, against a scan that itself covers only 205.9 of the 210 mm.
Closing that would need a scan of an uncut blank on a flatbed, not a photograph.

## Deployment

Cloudflare **Workers** with static assets, not Pages: Cloudflare treats Pages as legacy,
and `wrangler deploy` creates the project itself, so a release needs no dashboard step.
`wrangler.toml` carries the project name, the assets directory and the custom domain, so
the workflow passes no arguments that could drift from it.

The first attempt did use Pages and failed with "The Pages project does not exist" —
that path requires creating the project by hand first.

## Not done yet

- Overlay printing onto pre-printed NCR stock (`drawBlank: false` exists in the renderer
  but is unused and would need per-printer calibration).
