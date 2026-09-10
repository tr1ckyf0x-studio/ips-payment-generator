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

## On a phone

The layout collapses to one column below 900 px, and measured well: nothing overflows
sideways at 375 px. What that missed is that the page is 2.1 screens tall there with a
single slip and grows by about another screen for each one added, and the buttons that
produce the document sat on the first of them — so the last step of every visit was
scrolling back up to find them. The header is `position: sticky` at that
width, at about 15 % of the screen.

That also means the editor column has to stop being a scroll container there
(`overflow: visible`): a sticky child of a box that never scrolls never sticks, and the
page, not the column, is what scrolls on a phone.

`e2e/mobile.spec.ts` runs at a phone's viewport with touch, under its own Playwright
project, rather than a desktop window made thin.

## Getting the document out

`src/ui/pdfFile.ts` holds both ways a finished PDF leaves the app, because a slip saved
and a slip printed must never be different bytes.

Printing has no single way to do it, and the routes are chosen by capability rather than
guessed at:

- `navigator.pdfViewerEnabled` says the browser draws PDFs itself instead of handing
  them to the operating system — in practice, a desktop browser rather than a phone.
  There the document goes into a frame of its own and `print()` opens the dialog on it.
  The frame is `visibility: hidden` and not `display: none`: a frame that is not laid
  out has nothing to print.
- Where it does not, the system share sheet is the way to the printer, and on a phone
  that sheet is where Print lives. Asked for with `navigator.canShare({ files })`.
- Neither, or a popup the browser blocked: the file itself, under the name it would have
  been saved under. This is what a blob URL opened in a tab loses — the browser names
  the download after the URL's UUID, so `nalog-za-uplatu-2026-09-10.pdf` arrives as
  `a376646f-f9ee-4329-8d44-5878f4fed2b6.pdf`.

**Safari is the one thing here recognised by name.** It draws PDFs and still ignores
`print()` from a frame; there is no capability to test for that, so it gets the document
in a tab and presses Cmd-P itself. The alternative is a button that silently does nothing.

The frame route needs `frame-src 'self' blob:` in the content security policy —
documents this page made, and nothing else.

**The document asks not to be rescaled.** `/ViewerPreferences << /PrintScaling /None >>`
in the catalog is the PDF's own way of saying "open the print dialog at actual size", and
a dialog is exactly where "fit to page" is easiest to leave switched on — at which point
the slip stops being 210 x 99 mm. Acrobat and macOS Preview honour it; Chrome ignores it,
so the form still says so in words. It costs one dictionary entry.

`tests/render.spec.ts` reads it back out of the generated bytes. A plain-text search for
it in the output finds nothing and proves nothing: pdf-lib packs the catalog into a
compressed object stream, so the only honest check is to parse the document again.

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
- **Nothing about a payment is kept anywhere** — not between visits, not between slips
  within a visit. A new slip starts empty; the way to reuse a payer is Duplicate, which
  copies the whole slip and is explicit about it. The interface language is the only
  thing written to `localStorage`, by i18next.

  This did once remember the payer, in `src/storage/payerDetails.ts`, and the store was
  careful about it — injected `Storage`, every access guarded, because Safari's private
  mode and blocked site data both throw. Careful storage of something not worth storing
  is still storage; it was removed rather than improved.
- Buttons and links carry the same accent focus ring the fields have. Nothing was
  missing there — the browser draws one of its own — so this is consistency, not a fix.
  A first reading said the ring was absent; it had been measured with `getComputedStyle`
  on elements that were **not focused**, which reports `outline-style: none` for
  anything. The check that means something is to press Tab and read the element that
  `document.activeElement` then returns.
- **A slip nobody has typed into is not a slip with something wrong with it.** An empty
  slip cannot make an IPS payload either, and the app used to open by saying so —
  greeting every visitor with a warning about fields they had not reached. `isBlank()`
  compares against `emptySlip` rather than against a list of fields, so a field added
  later cannot be forgotten here.
- "место и датум пријема" and "датум извршења" are filled in by the bank at payment
  time, so they are neither form fields nor model fields — but their rules and wording
  are still drawn. `tests/values.spec.ts` guards both halves of that.

## IPS QR

Payload per `references/ips/nbs-preporuke-validacija.pdf`, built in `src/ips/payload.ts`.
Drawn as vector rectangles (runs of dark modules merged) at 30 x 30 mm in the lower-right
quadrant — the only free space on a blank that predates instant payments.

**The account is padded, not just stripped.** Tag R takes eighteen bare digits, but an
invoice prints the middle part without its leading zeros — `165-55-74`, never
`165-0000000000055-74`. The recommendations give the rule by worked example (item 10):
the bank code is three digits, the control number two, and the middle is padded to
thirteen. `accountDigits()` implements it and `tests/slip.spec.ts` holds it to all three
of the document's examples. Requiring eighteen typed digits, as this did at first,
rejects most real accounts as they are written.

`formatAccount()` is built on the same function, so a short entry is expanded on paper
exactly as it is in the QR. The printed field and the code must not disagree about what
is being paid.

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

## Checked against paper

The blank was printed and scanned lying on a real one, both slips in the same frame so
the scanner's scale cancels and only their difference matters. Measured relative to each
slip's own first block rule, so where each sheet sat on the glass cancels too.

The left column — everything the card-calibrated measurement had fixed — came out right:

| | printed | real blank | difference |
|---|---:|---:|---:|
| block width | 90.93 | 90.77 | +0.16 |
| block height | 15.11 | 15.12 | −0.01 |
| block pitch | 21.16 | 21.10 | +0.06 |
| separator past block | 7.06 | 7.01 | +0.04 |

Two things were wrong and are now corrected:

- **The right column sat 0.13 mm low**, so the three framed rows moved up by that much.

  The first reading said 0.37, and `1.3.0` shipped that. It was measured on the rows'
  horizontal rules through a wide window, which also took in the caption above each box —
  black on our print, pale brown on the blank, so the two slips' rows were pulled by
  different amounts. Measured instead on the boxes' own **vertical edges**, which carry no
  caption, the three rows read +0.13, +0.06 and +0.19. `1.3.0` therefore over-corrected by
  about a quarter of a millimetre, and `1.3.1` put it back.

  The lesson is narrow and worth keeping: when comparing two prints of the same thing,
  measure a feature that exists in both and is surrounded by the same things in both. A
  window wide enough to catch neighbouring ink measures the neighbours.
- **The model box was 13 mm and should be 10.** The next box does not move; the gap
  between them opens from 5 mm to 8. A card-calibrated scan had read 10.01 mm for it
  earlier and I put it down to a stroke of text — two scans agreeing settled it.

`tests/profiles.spec.ts` holds both, and was verified to fail on the old numbers.

### How close is close enough

**Half a millimetre.** The blank is accepted at that, and corrections smaller than it are
not worth making. A payment is read from the QR or from the printed digits; nothing at a
bank counter depends on a tenth of a millimetre, and the slip is cut by a guillotine that
varies by more than that anyway.

This is a decision, not a limit of the tools, and it exists because chasing tighter than
half a millimetre went wrong twice in one day. Both times the number was an artefact of
how it was measured:

- **0.37 mm that was really 0.13.** Measured over the rows' horizontal rules through a
  window wide enough to include the caption above each box — black on our print, pale
  brown on the blank, so the two were pulled by different amounts. `1.3.0` shipped the
  over-correction and `1.3.1` took it back.
- **1.9 mm that cannot exist.** A later overlay put the right column 1.9 mm from where
  this very repository draws it — a figure matching no version the project has ever had.
  The comparison spans sixty millimetres horizontally, so a fraction of a degree of skew
  moves it by that much, and the skew detector was itself broken: it reported 1.52° for a
  PDF rendered straight from this code, where there is none.

The trap in both is the same, and it is worth naming: **features were identified by their
order** — the third vertical rule from the left — so one stray edge from a paper edge or a
stroke of text shifted every index after it. Anything measured this way again should find
each feature in a window around where the profile says it belongs, and should measure skew
before comparing anything across the width of the sheet.

What is settled, and settled well: the left column matches the real blank to 0.03 mm in
both block height and pitch, and the right column's own internal spacing matches to
0.06 mm. Where each column sits relative to the other is known to about half a millimetre,
which is the tolerance above.

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

## Tested in a browser, against what ships

`npm test` never opens the app. Every user-visible breakage this project has had was
found by looking at the page — a dev server serving a stale dependency pre-bundle, pdf.js
6 changing what `render` accepts, a preview that silently drew nothing — and not one of
them would have failed a unit test.

`npm run test:e2e` runs Playwright over five things that can only be seen in a browser:
that filling the form draws a QR, that switching language keeps what was typed and leaves
the address alone, that each language answers from its own address, that the Download
button hands over something starting `%PDF-`, and that a path which does not exist
answers 404. Anything the page logs as an error fails the test it happened in.

**It runs against `dist`, served with `public/_headers`.** Not the dev server, which
bundles differently, and not `vite preview`, which ignores the headers — `tools/serveDist.ts`
exists to apply them. That is what makes a content security policy blocking the pdf.js
worker a failing test rather than a broken deployment.

`reuseExistingServer` is off, and that is not tidiness. A server left running from an
earlier session held the port, served its own copy of `_headers` read once at its start,
and the suite passed against a policy that had been deliberately broken to prove the
tests could see it. A stale server invalidates the whole exercise silently; a rebuild each
run is the cheaper mistake.

## The privacy promise is enforced, not asserted

Every page says payment details do not leave the device. `public/_headers` makes the
browser hold us to it: `connect-src 'self'` means the page cannot open a connection to
any other origin, and `form-action 'none'` means it cannot post anywhere at all. If
something one day tried to phone home, it would fail rather than succeed quietly.

The policy is as tight as the app allows, and the exceptions are all earned: pdf.js runs
a worker of its own and uses WebAssembly, and each page carries an inline `<style>` for
the copy shown before the app mounts. It was arrived at by serving the built site under
this exact policy and watching the console — filling the form, rendering the preview and
building a PDF produced no violation at all. `vite preview` does not apply `_headers`, so
that check needs a server that does.

`tests/seo.spec.ts` holds the directives that carry the promise, so widening them is a
deliberate act rather than a slip.

## Being found

A search engine can offer one page per URL, so three languages need three URLs:
`/` is Russian, `/sr/` Serbian, `/en/` English. `src/i18n/routing.ts` is the only place
that mapping lives; `tests/seo.spec.ts` holds the three pages to it.

**One URL, one language.** The path decides and `Accept-Language` gets no vote. Serving
whatever the browser asks for at a single address is dynamic serving, and it would have
let a crawler — which asks in English and has no stored preference — index the root as
English while that same page's markup declared Russian and pointed `hreflang` at `/en/`.
The root would have competed with `/en/` for the same content. A visitor's own choice is
still remembered between visits, and a crawler has no such memory, so the root stays
Russian for it.

**The address never changes while the app is used.** Switching language in the form
re-renders in place; it does not rewrite the address bar, so nothing typed is lost. The
three URLs are entry points, not routes.

**Each page says what it is before any script runs.** The body carried nothing but an
empty `#root`, which is all a crawler's first pass would have seen. Each now holds a
heading, a paragraph and a list in its own language, inside `#root`, which React replaces
on mount. The runtime `documentTitle` was also changed to match the `<title>` in the
markup — a rendering crawler reads the runtime one, so the two disagreeing would have
thrown away whichever was better.

**Wrong paths 404 rather than answering with the app.** `not_found_handling` was
`single-page-application`, which returned 200 and the whole app for every path that did
not exist — an unlimited supply of duplicate pages, and a soft 404 to anything crawling
it. There were never any client-side routes to justify it. `html_handling` is now spelled
out too, since it is what lets a hand-typed `/sr` reach `/sr/index.html`.

**The link card's picture is generated, not drawn.** Sharing the address produced a bare
link because there was no `og:image` at all. `npm run og` builds `public/og.png` from a
real rendered slip — the sheet cropped to its top cell, laid on the site's own dark ground
— so the card cannot advertise something the generator no longer produces. The page is
sized 1200 x 630 *points* and rasterised at 72 dpi, which lands on exactly that many
pixels without resampling.

Two things that were not obvious while writing it: cropping the sheet with `setMediaBox`
leaves the content where it was and it draws off the top of the picture — `embedPage`
with a bounding box brings its own translation and is the way. And the slip carries no
background of its own, so on a dark ground its black rules all but vanish; a white
rectangle goes under it first.

`public/` carries `robots.txt`, `sitemap.xml` listing the three pages with their
alternates, an SVG icon, that picture and the 404 page.

Still to do, and neither is code: verify the domain in Google Search Console and submit
the sitemap, and get a link to the site from somewhere Google already crawls. Nothing
here makes a page rank on its own; it makes it eligible.

## Deployment

Cloudflare **Workers** with static assets, not Pages: Cloudflare treats Pages as legacy,
and `wrangler deploy` creates the project itself, so a release needs no dashboard step.
`wrangler.toml` carries the project name, the assets directory and the custom domain, so
the workflow passes no arguments that could drift from it.

The first attempt did use Pages and failed with "The Pages project does not exist" —
that path requires creating the project by hand first.

## Git and releases

**One logical change, one commit**, the message a single line in the past tense — with
one exception: the version bump reads `Release 1.1.0`, naming the release rather than
describing an action. That
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
| MAJOR | what the slip contains, or how big it is | an element added or removed, a different default blank, the 99 mm cell changing |
| MINOR | a new capability, or geometry corrected **towards** the real blank | another interface language, another blank variant, a field measured into a better position |
| PATCH | fixes and internals, output byte-identical | a shrink-to-fit bug, a dependency bump, bundle work |

A release that only undoes an error of a previous one is **PATCH**, even though paper
moves: it restores what should have shipped rather than changing it. `1.3.1` was that —
`1.3.0` had over-corrected the right column by a quarter of a millimetre.

Moving something on the sheet is MINOR **only when there is a measurement showing the
new position is closer to the physical blank than the old one**. That is the arbiter, and
it is what stops "minor" from becoming a licence to nudge things by eye: without such
evidence, moving an element is MAJOR. The comparison is usually a scan holding our
printout and a real slip in one frame, where the scanner's own scale cancels.

`1.0.0` was cut under a stricter reading of this — any movement at all counted as MAJOR —
which made a 0.4 mm correction cost a major version. The rule was relaxed rather than
quietly ignored.

### Cutting a release

The version in `package.json` and the tag must agree — `deploy.yml` stops if they do not,
because a build labelled with the wrong version is worse than no build.

```bash
npm version 0.2.0 --no-git-tag-version     # package.json only
git commit -am 'Release 0.2.0'
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

### The `production` environment

GitHub creates it from the `environment:` block in `deploy.yml`, and it now carries the
deployment credentials and a gate:

- **`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are environment secrets**, not
  repository ones. A token that can deploy is therefore unreadable by any workflow that
  does not declare `environment: production` — CI on a pull request cannot see it.
- **Only a tag shaped `x.y.z` may deploy to it.** The pattern is `[0-9]*.[0-9]*.[0-9]*`,
  and it is checked by GitHub before the job starts, so unlike the workflow's own shell
  check it cannot be removed by editing the workflow.

  The pattern is **fnmatch, not a regular expression** — GitHub matches these with Ruby's
  `File.fnmatch`. `[0-9]+.[0-9]+.[0-9]+`, which is what the workflow's own `on: push:
  tags` filter uses, matches nothing here: `+` is a literal plus, not a quantifier. The
  environment page said "currently applies to 0 tags", which is worth reading rather than
  skimming.

A required reviewer was tried and removed. It guarded the wrong thing: the worry was a
pull request that edits a workflow to print the secrets, and that is already impossible —
a pull request from a fork runs with no access to repository secrets at all, and `ci.yml`
is triggered by `pull_request`, not `pull_request_target`, which is the trigger that would
hand them over. The reviewer only stood between someone who already had write access and
the token, and cost a click on every release.

## Not done yet

- Overlay printing onto pre-printed NCR stock (`drawBlank: false` exists in the renderer
  but is unused and would need per-printer calibration).
- Reading an existing IPS QR and filling the form from it — the inverse of what
  `payload.ts` already does, and `jsqr` is already a dependency.
