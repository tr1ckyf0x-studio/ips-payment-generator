/**
 * Measurements of a "nalog za uplatu" blank, and the factory that turns them into a
 * drawable profile.
 *
 * There are two blanks in play and they are genuinely different, so the numbers are
 * data and the construction is shared. Everything a blank differs by lives in
 * `BlankGeometry`; everything about how a blank is drawn — the wording, the type sizes,
 * where captions sit relative to their rules — is the same for both and lives here.
 */
import type { Box, FieldSlot, FormProfile, Label, Mm, Primitive, QrArea, Rule } from './types.ts';

export interface FieldBox {
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
}

export interface RuleSpec {
  x0: Mm;
  x1: Mm;
  y: Mm;
}

export interface BlankGeometry {
  id: string;
  /** The three open blocks of the left column. */
  blocks: { x0: Mm; x1: Mm; tops: [Mm, Mm, Mm]; height: Mm };
  /** Vertical line dividing the two columns. */
  separatorX: Mm;
  fields: {
    sifraPlacanja: FieldBox;
    valuta: FieldBox;
    iznos: FieldBox;
    racunPrimaoca: FieldBox;
    model: FieldBox;
    pozivNaBroj: FieldBox;
  };
  rules: { potpis: RuleSpec; mesto: RuleSpec; datum: RuleSpec };
  /** "način izvršenja - hitno", absent from blanks printed before 65/2018. */
  hitno?: FieldBox;
  /** Top of the title's bounding box, and the x its right edge aligns to. */
  title: { yTop: Mm; right: Mm };
  /** "Образац бр. 1" at the foot of the blank. */
  footer: { centre: Mm; yTop: Mm };
  /** Where the QR sits horizontally and how big it is; its `y` is derived. */
  qr: Omit<QrArea, 'y'>;
  boxStroke: Mm;
  ruleStroke: Mm;
}

/** Type sizes in points, fitted to the reference by `npm run visual`. */
const TYPE = {
  title: 13.6,
  label: 8,
  footer: 6.85,
  hitno: 7,
} as const;

const PT_TO_MM = 25.4 / 72;

/**
 * Distance from a label's top down to its baseline, as a fraction of the point size,
 * measured on rendered ink rather than taken from font metrics: the reference does not
 * embed its Arial, so `pdftotext -bbox` reports a substitute's metrics and following
 * those put every label half a millimetre low.
 */
const ASCENT_RATIO = 0.723;
/** The same for an all-capitals line, whose ink starts at the cap height. */
const ASCENT_RATIO_CAPS = 0.679;
/** How far ink drops below the baseline; measured on the deepest glyphs used. */
const DESCENDER_RATIO = 0.213;

/**
 * Clearance between a label's descenders and the rule below it. The pausal reference
 * crowds these to 0.05 mm, which dropped the tail of "платилац" onto its rule; the
 * OPTIMUM blanks leave 1.19 to 1.32 mm, and that is what is reproduced.
 */
const LABEL_CLEARANCE: Mm = 1.25;
/** Leading between the two lines of the "шифра плаћања" label. */
const LABEL_LINE: Mm = 2.83;
/** How far a caption sits below the rule it names. */
const CAPTION_BELOW_RULE: Mm = 1.1;

/** Value type. Values are set in a condensed face, as a machine-filled slip is. */
const VALUE_SIZE = 10;
const BLOCK_INSET: Mm = 1.4;
const BLOCK_FIRST_BASELINE: Mm = 4.9;
const BLOCK_LINE_HEIGHT: Mm = 4.2;


function label(
  id: string,
  x: Mm,
  yTop: Mm,
  text: string,
  size: number = TYPE.label,
  { caps = false }: { caps?: boolean } = {},
): Label {
  const ratio = caps ? ASCENT_RATIO_CAPS : ASCENT_RATIO;
  return { kind: 'label', id, x, baseline: yTop + ratio * size * PT_TO_MM, text, size };
}

/** Top of a label placed by its clearance to the rule beneath it. */
function topAbove(ruleY: Mm, size: number = TYPE.label): Mm {
  return ruleY - LABEL_CLEARANCE - (ASCENT_RATIO + DESCENDER_RATIO) * size * PT_TO_MM;
}

function labelAbove(id: string, x: Mm, ruleY: Mm, text: string, size: number = TYPE.label): Label {
  return { ...label(id, x, topAbove(ruleY, size), text, size), anchoredAbove: ruleY };
}

export function createProfile(g: BlankGeometry): FormProfile {
  const rule = (id: string, x0: Mm, y0: Mm, x1: Mm, y1: Mm): Rule => ({
    kind: 'rule', id, x0, y0, x1, y1, stroke: g.ruleStroke,
  });
  const box = (id: string, f: FieldBox): Box => ({
    kind: 'box', id, x: f.x, y: f.y, w: f.w, h: f.h, stroke: g.boxStroke,
  });

  const { x0, x1, tops, height } = g.blocks;
  const openBlock = (id: string, top: Mm): Rule[] => [
    rule(`${id}-top`, x0, top, x1, top),
    rule(`${id}-left`, x0, top, x0, top + height),
    rule(`${id}-right`, x1, top, x1, top + height),
    rule(`${id}-bottom`, x0, top + height, x1, top + height),
  ];

  const f = g.fields;
  const primitives: Primitive[] = [
    box('sifraPlacanja', f.sifraPlacanja),
    box('valuta', f.valuta),
    box('iznos', f.iznos),
    box('racunPrimaoca', f.racunPrimaoca),
    box('model', f.model),
    box('pozivNaBroj', f.pozivNaBroj),

    ...openBlock('platilac', tops[0]),
    ...openBlock('svrhaUplate', tops[1]),
    ...openBlock('primalac', tops[2]),

    rule('columnSeparator', g.separatorX, tops[0], g.separatorX, tops[2] + height),

    rule('potpisRule', g.rules.potpis.x0, g.rules.potpis.y, g.rules.potpis.x1, g.rules.potpis.y),
    rule('mestoIDatumRule', g.rules.mesto.x0, g.rules.mesto.y, g.rules.mesto.x1, g.rules.mesto.y),
    rule('datumIzvrsenjaRule', g.rules.datum.x0, g.rules.datum.y, g.rules.datum.x1, g.rules.datum.y),

    {
      ...label('titleLabel', 0, g.title.yTop, 'НАЛОГ ЗА УПЛАТУ', TYPE.title, { caps: true }),
      bold: true,
      anchorRight: g.title.right,
    },
    labelAbove('platilacLabel', x0 + 0.54, tops[0], 'платилац'),
    label('sifraLabel', f.sifraPlacanja.x + 0.06, topAbove(f.sifraPlacanja.y) - LABEL_LINE, 'шифра'),
    labelAbove('placanjaLabel', f.sifraPlacanja.x + 0.06, f.sifraPlacanja.y, 'плаћања'),
    labelAbove('valutaLabel', f.valuta.x + 0.19, f.valuta.y, 'валута'),
    labelAbove('iznosLabel', f.iznos.x + 0.35, f.iznos.y, 'износ'),
    labelAbove('racunLabel', f.racunPrimaoca.x + 0.06, f.racunPrimaoca.y, 'рачун примаоца'),
    labelAbove('svrhaLabel', x0 + 0.54, tops[1], 'сврха уплате'),
    labelAbove('modelLabel', f.model.x + 0.06, f.model.y, 'модел и позив на број (одобрење)'),
    labelAbove('primalacLabel', x0 + 0.54, tops[2], 'прималац'),
    label('potpisLabel', x0 + 0.54, g.rules.potpis.y + CAPTION_BELOW_RULE, 'потпис платиоца'),
    label('mestoLabel', g.rules.mesto.x0 + 0.18, g.rules.mesto.y + CAPTION_BELOW_RULE, 'место и датум пријема'),
    label('datumLabel', g.rules.datum.x0 + 0.41, g.rules.datum.y + CAPTION_BELOW_RULE, 'датум извршења'),
    {
      ...label('obrazacLabel', 0, g.footer.yTop, 'Образац бр. 1', TYPE.footer),
      anchorCentre: g.footer.centre,
    },
  ];

  const blockSlot = (field: string, top: Mm): FieldSlot => ({
    field,
    x: x0 + BLOCK_INSET,
    w: x1 - x0 - 2 * BLOCK_INSET,
    baseline: top + BLOCK_FIRST_BASELINE,
    size: VALUE_SIZE,
    align: 'left',
    lineHeight: BLOCK_LINE_HEIGHT,
    maxLines: 3,
  });
  /** A framed field's value is centred in it, horizontally and vertically. */
  const boxSlot = (field: string, b: FieldBox): FieldSlot => ({
    field,
    x: b.x,
    w: b.w,
    // Fallback for anything that cannot resolve the centre; the renderer overrides it.
    baseline: b.y + b.h * 0.79,
    verticalCentre: b.y + b.h / 2,
    size: VALUE_SIZE,
    align: 'center',
  });

  const slots: FieldSlot[] = [
    blockSlot('platilac', tops[0]),
    blockSlot('svrhaUplate', tops[1]),
    blockSlot('primalac', tops[2]),
    boxSlot('sifraPlacanja', f.sifraPlacanja),
    boxSlot('valuta', f.valuta),
    boxSlot('iznos', f.iznos),
    boxSlot('racunPrimaoca', f.racunPrimaoca),
    boxSlot('model', f.model),
    boxSlot('pozivNaBroj', f.pozivNaBroj),
  ];

  if (g.hitno) {
    primitives.push({ ...box('hitno', g.hitno), beyondReference: true });
    primitives.push({
      ...label('hitnoLabel', 0, g.rules.datum.y + CAPTION_BELOW_RULE, 'ХИТНО', TYPE.hitno),
      anchorCentre: g.hitno.x + g.hitno.w / 2,
    });
    slots.push(boxSlot('hitno', g.hitno));
  }

  return { id: g.id, width: 210, height: 99, primitives, slots, qr: qrArea(g) };
}

/**
 * The QR, centred in the clear band between the framed fields and the hitno box.
 *
 * Derived rather than declared. As a coordinate it went stale the moment either
 * neighbour moved: the symbol sat 0.5 mm under "позив на број" and 7.2 mm above hitno,
 * which reads as crowding the field above it rather than as occupying the gap. The band
 * is the only free space on a blank that predates instant payments, so the rule is
 * simply to sit in the middle of it.
 *
 * Without a hitno box the band ends at the "датум извршења" rule, which is where that
 * box's lower edge lands anyway.
 */
function qrArea(g: BlankGeometry): QrArea {
  const top = g.fields.pozivNaBroj.y + g.fields.pozivNaBroj.h;
  const bottom = g.hitno ? g.hitno.y : g.rules.datum.y;
  return { x: g.qr.x, y: top + (bottom - top - g.qr.size) / 2, size: g.qr.size };
}
