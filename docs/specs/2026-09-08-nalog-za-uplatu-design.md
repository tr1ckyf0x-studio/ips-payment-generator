# Design: Nalog za uplatu (Obrazac br. 1) PDF generator

Date: 2026-09-08
Status: approved for planning

## 1. Purpose

A browser-only React application that produces a print-ready A4 PDF containing one or
more Serbian payment slips ("nalog za uplatu", Obrazac br. 1) at their true physical
size, so the printed sheet can be cut into slips and handed over at a bank or
menjačnica.

The user fills a form (labels in Russian, sub-labels in Serbian), adds as many slips as
needed, and downloads a single PDF. A later stage adds an NBS IPS QR code to each slip.

## 2. Regulatory basis and what it does not fix

Source: *Odluka o obliku, sadržini i načinu korišćenja obrazaca platnih naloga za
izvršenje platnih transakcija u dinarima* ("Sl. glasnik RS" 55/2015, 78/2015, 82/2017,
65/2018, 78/2018, 22/2019, 125/2020, 82/2024). A copy is in
`references/odluka-nbs-platni-nalozi.pdf`.

Point 7 fixes:

- rectangular shape, **99 × 210 mm**, i.e. exactly 1/3 of A4;
- printed on white self-copying paper with black lines;
- at least two copies per form.

Prilog 1 shows the appearance and arrangement of the elements **as a picture only**.
Prilog 2 defines the content of each element, Prilog 3 the payment codes
(`šifra plaćanja`).

**The decision does not fix exact coordinates of the fields.** Point 7 further allows a
payment service provider to adopt a different form and a different arrangement of
elements. Consequently every print shop draws its own variant: the reference used here
prints "печат и потпис платиоца" while the OPTIMUM d.o.o. blank the user actually pays
with prints "потпис платиоца".

Practical consequence: our geometry is a *de facto* reproduction, not a *de jure* one.
The tests below assert that we reproduce a chosen reference faithfully, not that the
reference is uniquely correct.

### Edition matters

The terminology changed with the 2015+ decision. Documents still circulating with
"уплатилац", "датум валуте" and "печат и потпис уплатиоца" are the **old edition**. The
current edition — and the user's real blanks — use **"платилац"**, **"датум извршења"**,
**"потпис платиоца"**. Only current-edition sources may be used as geometry references.

## 3. Reference sources

| File in `references/` | Size | Edition | Vector | Role |
|---|---|---|---|---|
| `reference-uplatnica-pausal.pdf` | 209.66 × 100.83 mm | current | yes | **primary geometry reference** |
| `scans/optimum-2026-09-04.pdf` | photo, ~208 × 96 mm | current | no | cross-check, real accepted blank |
| `scans/optimum-2026-08-19.pdf` | photo, ~208 × 96 mm | current | no | cross-check |
| `odluka-nbs-platni-nalozi.pdf` | A4, 11 pp | current text | — | normative text, Prilog 3 codes |
| `obrazac1-paragraf-old-edition.pdf` | 209.97 × 99.99 mm | old | yes | historical only — do not use |
| `nbs-prilog1-old-edition.pdf` | A4 | old | yes | historical only — do not use |

The primary reference originates from `https://pausal.rs/assets/pdf/uplatnica.pdf`. It
carries a `HSFormular © 2002-2015 Handy soft` credit, i.e. it is itself a commercial
redraw — chosen because it is vector, current-edition, and already sized as a blank
rather than as an A4 sheet with a form somewhere on it.

The scans contain the user's personal data (name, address, account) and are therefore
git-ignored; they stay on disk for local verification only.

## 4. Measured geometry

Extracted programmatically with `tools/extractGeometry.ts` (parses a `pdftocairo -svg`
dump, applies the path transform, converts pt → mm). All coordinates are millimetres
from the **top-left corner of the slip**.

### 4.1 Boxes (stroke 0.47 mm)

| Field | x | y | w | h |
|---|---|---|---|---|
| šifra plaćanja | 113.18 | 17.98 | 11.97 | 5.98 |
| valuta | 129.63 | 17.98 | 11.97 | 5.98 |
| iznos | 149.58 | 17.98 | 49.86 | 5.98 |
| račun primaoca | 113.18 | 29.94 | 86.26 | 5.98 |
| model | 113.18 | 41.91 | 11.97 | 5.98 |
| poziv na broj | 129.63 | 41.91 | 69.80 | 5.98 |

### 4.2 Left blocks and rules (stroke 0.353 mm)

Three open boxes, `x` from 8.98 to 98.72 (width 89.75), height 13.96:

| Field | y top | y bottom |
|---|---|---|
| platilac | 12.99 | 26.95 |
| svrha uplate | 32.44 | 46.40 |
| primalac | 51.88 | 65.84 |

Vertical separator: `x = 104.70`, `y` 12.99 → 65.84.

Signature rules: `y = 72.82` (x 8.98 → 63.82), `y = 80.80` (x 48.86 → 98.72),
`y = 80.80` (x 113.18 → 148.08).

### 4.3 Labels

Extracted with `pdftotext -bbox-layout`; positions are the text bounding-box top-left
and the sizes below are **bounding-box heights, not point sizes**.

These coordinates are a record of the reference, not the values we draw at. Point sizes
were solved separately by fitting rendered widths (section 8), and the labels that sit
above a rule are positioned by clearance instead — copying the y values below verbatim
is what put "платилац" on its rule. Representative entries:

| Text | x | y | size |
|---|---|---|---|
| НАЛОГ ЗА УПЛАТУ | 156.24 | 9.16 | bold, cap height 4.24 |
| платилац | 9.52 | 10.22 | 2.61 |
| шифра / плаћања | 113.24 | 11.28 / 14.11 | 2.61 |
| валута | 129.82 | 14.81 | 2.61 |
| износ | 149.93 | 14.81 | 2.61 |
| рачун примаоца | 113.24 | 26.81 | 2.61 |
| сврха уплате | 9.52 | 29.63 | 2.61 |
| модел и позив на број (одобрење) | 113.24 | 38.80 | 2.61 |
| прималац | 9.52 | 49.03 | 2.61 |
| потпис платиоца | 9.52 | 74.08 | 2.61 |
| место и датум пријема | 49.04 | 81.84 | 2.61 |
| датум извршења | 113.59 | 81.84 | 2.61 |
| Образац бр. 1 | 98.25 | 87.84 | 2.28 |

The reference's own `HSFormular ©` credit at `8.82, 87.84` is **not** reproduced.
The signature label follows the user's OPTIMUM blank: "потпис платиоца" — a shorter
string at the same left edge.

The **`hitno` element** ("način izvršenja - hitno", introduced by 65/2018) is absent
from the primary reference but present on the OPTIMUM blanks, as a small box right of
"датум извршења". It was measured from the scans once a better one arrived (02.06.2026,
400 ppi): `x 178.04, w 5.15, h 4.1`, lower edge on the "датум извршења" rule, with two
scans agreeing to 0.07 mm on the left edge. Prilog 2 of the decision specifies the
letter **H** as its content, and a slip carrying H for up to 300,000 dinars must be
executed as an instant transfer.

Measuring it also revealed that the QR, placed earlier, overlapped this box; the QR was
moved and reduced to 26 mm, and a test now asserts it overlaps no element of the blank. This is the one element whose position is not yet established.

### 4.4 Fit onto A4

Content ends at y ≈ 90 mm, inside the normative 99 mm cell, so three cells stack to
exactly 297 mm — a full A4 with no content clipped. Horizontally content spans
8.98 → 199.44 mm, leaving 9.0 mm left and 10.6 mm right margin, clearing the Epson
EcoTank L3280 minimum of 3 mm with room to spare.

### 4.5 Cut guides

A dashed rule spans the full sheet width at every cell boundary — `y = 99` and
`y = 198` mm — so the printed sheet can be cut into slips of the correct size. Drawn at
0.25 mm with a 2 mm on / 2 mm off pattern.

The guides are drawn unconditionally, including when a sheet holds a single slip: the
rule at 99 mm is then the line along which the unused remainder of the sheet is
trimmed, yielding a slip of exactly 210 × 99 mm. No rule is drawn at `y = 297`, which
is the sheet edge itself.

## 5. Architecture

The organising decision: **the layout is data, not code.**

```
        LayoutSpec  (declarative primitives, millimetres)
              |
      +-------+--------+
      |                |
  PdfRenderer      geometry dump
   (pdf-lib)        for tests
      |                |
  printable PDF   compared against reference
```

Three consequences, each of which is the reason for the split:

- **Layout tests reduce to comparing two arrays of rectangles**, one from the spec and
  one extracted from the reference PDF. No image diffing, no visual judgement.
- **Blank variants are a Strategy.** Both `pausalProfile` and `optimumProfile` exist and
  the renderer never changed to accommodate the second; `createProfile()` builds either
  from a `BlankGeometry`. This is the part of the original design that paid off most.
- **A second output backend is a Bridge.** Should an SVG output ever be wanted, it
  consumes the same spec.

Millimetres are the unit everywhere. Conversion to PostScript points happens only
inside the renderer, at the pdf-lib boundary. `Mm` is a branded type so a millimetre
value cannot be silently passed where points are expected.

### 5.1 Modules

| Module | Responsibility | Depends on |
|---|---|---|
| `layout/formSpec.ts` | blank geometry as data | — |
| `layout/types.ts` | `Mm`, primitive union (`Box`, `Rule`, `Label`, `Value`) | — |
| `layout/paginate.ts` | `Slip[] → Page[]`, 3 cells per sheet | `model/slip` |
| `pdf/renderer.ts` | walk spec → pdf-lib draw calls | pdf-lib, layout |
| `pdf/font.ts` | load and embed Liberation Sans (subset) | fontkit |
| `model/slip.ts` | `Slip` type, field validation | — |
| `data/paymentCodes.ts` | šifra plaćanja from Prilog 3 | — |
| `ui/SlipForm.tsx` | one slip's fields | model |
| `ui/SlipList.tsx` | add / remove / reorder slips | model |
| `ui/PdfPreview.tsx` | render generated PDF via pdf.js | pdfjs-dist |
| `ips/payload.ts` | IPS QR string (stage 2) | — |
| `ips/qr.ts` | QR matrix → vector modules (stage 2) | qrcode |

### 5.2 Preview

The on-screen preview renders **the generated PDF itself** through pdf.js into a
canvas. It is not a parallel HTML/CSS reproduction.

The dominant risk in this project is screen/paper divergence — the previous attempt
spent six consecutive commits chasing it through `window.print()`. A single renderer
removes the entire class of bug. Cost is roughly 1 MB of bundle, irrelevant for a local
utility.

### 5.3 Printing

The PDF is already A4 with exact geometry, so the print dialog must be set to
**Actual size / 100 %**, not "Fit to page". This is stated in the UI next to the
download button.

## 6. Data model

```typescript
interface Slip {
  id: string;
  platilac: string;        // payer, up to 3 lines
  svrhaUplate: string;     // purpose, up to 3 lines
  primalac: string;        // recipient, up to 3 lines
  sifraPlacanja: string;   // 3 digits, Prilog 3
  valuta: string;          // 'RSD'
  iznos: string;           // '5.200,00'
  racunPrimaoca: string;   // 18 digits, displayed XXX-XXXXXXXXXXXXX-XX
  model: string;           // '', '97', '11', '00'
  pozivNaBroj: string;
  mestoIDatumPrijema: string;
  datumIzvrsenja: string;
  hitno: boolean;          // 'način izvršenja - hitno', added by 65/2018
}
```

Payment codes are string-literal constants via `as const` objects, not `enum`.

**"место и датум пријема" and "датум извршења" are not part of the model.** The bank or
menjačnica writes them in when it accepts the payment — both OPTIMUM scans show them
added by Alta Pay, not by the payer. Their rules and wording are still drawn, because
the blank needs the space; only the form fields and the printed values are gone.

## 7. Verification loop

The point of the layout/renderer split. Runner: Vitest.

1. **`layout.spec.ts`** — spec geometry against a fixture extracted from the reference
   PDF. Tolerance 0.25 mm.
2. **`render.spec.ts`** — generate a PDF in Node, parse it back through the same
   extractor, compare against the spec. Catches renderer and coordinate-transform bugs,
   notably pdf-lib's bottom-left origin versus our top-left convention.
3. **`paginate.spec.ts`** — 1, 2, 3, 4, 7 slips produce the expected page count and
   cell offsets.
4. **`tools/scan_crosscheck.py`** (one-off script, not CI) — compares the layout against
   a photographed OPTIMUM blank. Because the scans are cropped and slightly rotated,
   absolute positions are meaningless; the script compares *ratios* of distances, which
   survive both distortions. Results are in section 7.1.
5. **`npm run visual`** — generate a PDF, rasterise it, place it beside the reference
   render for eyeball comparison.

The same extractor serves both sides of every comparison, so there is one code path to
trust rather than two.

### 7.0 The OPTIMUM blank, measured

Once a 400 ppi scan arrived and the pale rules could be read, the blank was measured
outright rather than merely cross-checked. Across nine scans, with scale taken from each
scan's own page size:

| | OPTIMUM | pausal |
|---|---:|---:|
| block width | 90.67 mm | 89.75 mm |
| block height | 14.83 mm | 13.96 mm |
| block pitch | 21.09 mm | 19.45 mm |
| separator gap past blocks | 7.21 mm | 5.98 mm |

These are different blanks, not measurement noise — the figures agree across nine scans
of varying quality and resolution. `optimumProfile` reproduces them and is the default. The origin on the sheet is the one thing inferred
rather than measured, because every scan is cropped.

### 7.1 Result of the earlier OPTIMUM cross-check

Both photographs agree, and they disagree with the reference in the same direction:

| Scan | separator / block width | deviation |
|---|---|---|
| reference (pausal) | 1.06664 | — |
| optimum-2026-09-04 | 1.07838 | +1.10 % = +1.05 mm |
| optimum-2026-08-19 | 1.07692 | +0.96 % = +0.92 mm |

Two independent photographs deviating by the same sign and roughly the same amount is
a real difference in the blank, not camera noise: on the OPTIMUM stock the vertical
column separator sits about **1 mm further right** relative to the block width.

The difference is cosmetic — the separator is a divider, not a field, and nothing is
written against it — so the layout keeps the reference position. It is recorded here so
the choice is a decision rather than an oversight.

**What this check cannot tell us:** horizontal rules. A 90 mm rule photographed a
fraction of a degree off square breaks into pieces under run-length detection, while
rows of text register as rules; the detected horizontals are consequently unusable. The
verticals are short enough to survive the rotation, which is why only they are compared.
Settling the horizontal geometry against OPTIMUM would need a flatbed scan rather than a
phone photograph.

## 8. Stack

React 19, TypeScript, Vite. `pdf-lib` + `@pdf-lib/fontkit`, `pdfjs-dist`, Vitest.
Stage 2 adds `qrcode`. No backend; the app is fully static.

Fonts, both embedded as subsets:

- **Liberation Sans** for the blank's wording — metric-compatible with Arial, covers
  Serbian Cyrillic and Latin diacritics, OFL.
- **Roboto Condensed** for the slip data (Apache 2.0). A machine-filled slip is set in a
  condensed face: on the OPTIMUM scans the payer line measures 76.7 % of Arial's width at
  the same cap height (~81 % once ink spread is allowed for). Base size 10 pt matches the
  scan's 31.9 mm. Candidates compared with `npm run fonts`, which renders the same slip
  in each face at equal cap height; the alternatives measured 30.8 mm (PT Sans Narrow),
  39.7 mm (Roboto) and 43.3 mm (Liberation Sans) against the scan's 31.9 mm.

The title is set **bold, flush right**, matching the OPTIMUM blanks — 45.1 mm wide with
3.52 mm capitals and a stroke 0.178 of the cap height, where a regular weight would be
about 0.125. The pausal reference sets it regular.

### Fitting long values

Fields are fixed width, so a value that would overrun is scaled down instead
(`src/layout/fitText.ts`). Width is linear in point size, so the fitting size is one
division rather than an iterative search, and every line of a field shares one size.
Values are never truncated: dropping part of an account number or a purpose would be a
worse failure than small type. `renderDocument` reports what it shrank, and the form
warns only for fields that fell below legibility.

Vertical placement is calibrated by rasterising and measuring the ink, not by
`pdftotext -bbox`: the reference does not embed its Arial, so poppler reports a
substitute's metrics, and trusting them put every label 0.5 mm low.

Labels sitting above a rule are placed by their clearance to it rather than by the
reference's coordinate. The reference crowds them to 0.05-0.20 mm, which is what made
the descender of "платилац" touch the rule; the OPTIMUM blanks leave 1.19-1.32 mm and
that is what we reproduce.

## 9. IPS QR (implemented)

Payload format:

```
K:PR|V:01|C:1|R:{18 digits}|N:{recipient}|I:RSD{amount with decimal comma}|SF:{code}|S:{purpose}[|RO:{model}{poziv}]
```

The payload builder is written here rather than taken from the `ips-qr-code` package:
that package wraps a synchronous string build in a Promise, pulls dependencies, and
does not validate against the current NBS *Preporuke*.

The QR is drawn as **vector rectangles** — runs of adjacent dark modules merged — so it
stays sharp at any printer resolution without bloating the page. Placement: `x 169.4,
y 50, 30 × 30 mm`, flush with the right edge the framed fields align to.

### Rules found by probing the validator

Two requirements are absent from the recommendations and were established empirically
against `https://nbs.rs/QRcode/api/qr/v1/validate`:

1. **Text fields reject Cyrillic.** `N:ЈП ЕПС БЕОГРАД` returns 608 "Invalid field
   format"; the same name as `ČIGRA DOO LESKOVAC` passes. Since Serbian Cyrillic and
   Latin are officially equivalent, the builder transliterates instead of refusing.
2. **Model 97 references are check-digit validated.** `RO:97163220000111111` returns
   608, and the same reference with correct digits passes. The algorithm (ISO 7064
   MOD 97-10) is confirmed twice: against the specification's own `RO:9714123412`, and
   against a real invoice's reference number.

`npm run ips:verify` re-runs all thirteen cases against the live service.

### Error correction

**H**, deliberately stronger than the NBS generator's own. Probing established their
level as **L**: a 90-byte payload came back as a version 5 symbol, which holds only 84
bytes at level M. The correction level is part of the QR standard and every reader
detects it, so a stronger level costs nothing in compatibility while tolerating the
folding, stamping and pocket-wear a paper slip actually gets.

The price is density, and it is what fixes the two other choices here: the payer tag (P)
is omitted, and the symbol is 30 mm rather than 22. Together they keep a fully filled
slip at a 0.41 mm module, above the 0.4 mm floor for scanning from print. Omitting P is
sound on its own terms — it is optional, and the recommendations note the bank replaces
it with the holder of the account the money actually comes from.

## 10. Persistence

The payer's name and address are kept in `localStorage` under a single key and filled
into each new slip; a "забыть плательщика" control clears them. That is the only thing
carried between visits — everything else on a slip is specific to one payment.

Storage access is guarded rather than assumed: Safari's private mode and a browser with
site data blocked both throw, and the form must keep working there, merely forgetful.

## 11. Out of scope

Overlay printing onto pre-printed NCR blanks (would need per-printer calibration),
nalog za isplatu (Obrazac 2), nalog za prenos (Obrazac 3), and any backend.
