/**
 * Layout primitives for the payment slip.
 *
 * Every coordinate is millimetres measured from the top-left corner of a slip. Points
 * exist nowhere in this codebase except inside the renderer's single conversion
 * helper, which is why `Mm` is a plain alias rather than a branded type: branding
 * would force a cast around each of the ~60 literals in the spec and buy nothing,
 * since no competing unit is ever in scope.
 */
export type Mm = number;

/** A closed rectangle, stroked on all four sides. */
export interface Box {
  kind: 'box';
  id: string;
  x: Mm;
  y: Mm;
  w: Mm;
  h: Mm;
  stroke: Mm;
  /**
   * Set for an element the geometry reference does not have, so tests comparing against
   * it can tell a deliberate addition from a drift.
   */
  beyondReference?: boolean;
}

/** A straight rule. `dash` is an on/off pattern in millimetres. */
export interface Rule {
  kind: 'rule';
  id: string;
  x0: Mm;
  y0: Mm;
  x1: Mm;
  y1: Mm;
  stroke: Mm;
  dash?: [Mm, Mm];
}

/** Pre-printed wording belonging to the blank itself. */
export interface Label {
  kind: 'label';
  id: string;
  x: Mm;
  /** Baseline of the text, not the top of its bounding box. */
  baseline: Mm;
  text: string;
  size: number;
  bold?: boolean;
  /**
   * When set, the label is right-aligned to this x instead of starting at `x`. The
   * title is set this way because it is flush with the right edge of the fields.
   */
  anchorRight?: Mm;
  /** When set, the label is centred on this x. Used for the caption under a box. */
  anchorCentre?: Mm;
  /**
   * Set when the label is positioned by its clearance to the rule at this y, rather
   * than by a coordinate copied from the reference blank.
   */
  anchoredAbove?: Mm;
}

export type Primitive = Box | Rule | Label;

/** Where a slip's data is drawn. Separate from the primitives, which are the blank. */
export interface FieldSlot {
  /** Key of the `Slip` field this slot renders. */
  field: string;
  x: Mm;
  /** Width of the slot, used for centring. */
  w: Mm;
  /** Baseline of the first line. */
  baseline: Mm;
  /**
   * When set, the value is centred vertically on this y instead of sitting on
   * `baseline`. The renderer resolves it, because centring needs the font's cap height.
   */
  verticalCentre?: Mm;
  size: number;
  align: 'left' | 'center';
  /** Set for the three multi-line blocks in the left column. */
  lineHeight?: Mm;
  maxLines?: number;
}

/**
 * One printed blank: its outer size plus everything drawn on it.
 *
 * `height` is the normative 99 mm cell, which is larger than the drawn content — the
 * slack at the bottom is what lets three cells stack into exactly one A4 sheet.
 */
/** Where the IPS QR code goes on the blank. */
export interface QrArea {
  x: Mm;
  y: Mm;
  /** Side of the square symbol. */
  size: Mm;
}

export interface FormProfile {
  id: string;
  width: Mm;
  height: Mm;
  primitives: Primitive[];
  slots: FieldSlot[];
  qr: QrArea;
}
