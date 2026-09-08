"""Measures the geometry of an OPTIMUM blank from a scan.

The pausal reference is vector and exact, but it is a different blank: measured across
five scans, OPTIMUM's left blocks are 90.7 x 15.0 mm against pausal's 89.75 x 13.96.
This reads the real thing so a second FormProfile can be built from it.

Two things make it work where earlier attempts failed:

  * The rules are printed pale. Run-length detection with a threshold tuned for text
    misses them entirely; reading a brightness profile down a clean column finds them.
  * Scale comes from the PDF's own page size rather than from any reference, so the
    numbers are absolute millimetres and not relative to another blank.

Usage:  python3 tools/measure_blank.py references/scans/*.pdf
"""
import subprocess
import sys
import tempfile
from pathlib import Path

RENDER_DPI = 400
MM_PER_PX = 25.4 / RENDER_DPI
DARK = 180


def render(pdf: Path) -> tuple[int, int, bytes]:
    with tempfile.TemporaryDirectory() as tmp:
        stem = Path(tmp) / 'p'
        subprocess.run(
            ['pdftoppm', '-gray', '-r', str(RENDER_DPI), str(pdf), str(stem)],
            check=True, capture_output=True,
        )
        pgm = next(Path(tmp).glob('p*.pgm'))
        data = pgm.read_bytes()
    tokens, i = [], 0
    while len(tokens) < 4:
        while data[i:i + 1].isspace():
            i += 1
        if data[i:i + 1] == b'#':
            while data[i:i + 1] != b'\n':
                i += 1
            continue
        j = i
        while not data[j:j + 1].isspace():
            j += 1
        tokens.append(data[i:j])
        i = j
    return int(tokens[1]), int(tokens[2]), data[i + 1:]


def dark_bands(values, dark=DARK):
    """Centres of runs of dark samples — one per printed line crossed."""
    out, start = [], None
    for i, v in enumerate(values):
        if v < dark and start is None:
            start = i
        elif v >= dark and start is not None:
            out.append((start + i - 1) / 2)
            start = None
    if start is not None:
        out.append((start + len(values) - 1) / 2)
    return out


def column(px, w, h, x):
    return [px[y * w + x] for y in range(h)]


def row(px, w, x0, x1, y):
    return [px[y * w + x] for x in range(x0, x1)]


def measure(pdf: Path):
    w, h, px = render(pdf)

    # A column just inside the left blocks' right edge crosses all six of their rules
    # and nothing else.
    probe_x = None
    best = 0
    for x in range(int(w * 0.38), int(w * 0.46)):
        bands = dark_bands(column(px, w, h, x))
        inner = [b for b in bands if 0.05 * h < b < 0.85 * h]
        if len(inner) == 6 and (inner[5] - inner[0]) > best:
            best = inner[5] - inner[0]
            probe_x = x
    if probe_x is None:
        return None
    block_rules = [b for b in dark_bands(column(px, w, h, probe_x)) if 0.05 * h < b < 0.85 * h]

    # A row through the middle of the first block crosses its left edge, its right edge
    # and then the column separator a few millimetres further on. The block is the pair
    # roughly 90 mm apart; taking the outermost edges would measure to the separator.
    mid = int((block_rules[0] + block_rules[1]) / 2)
    edges = dark_bands(row(px, w, 0, int(w * 0.6), mid))
    block_left_mm = edges[0] * MM_PER_PX if edges else 0
    pair = next(
        ((a, b) for a in edges for b in edges
         if 85 < (b - a) * MM_PER_PX < 95),
        None,
    )
    if pair is None:
        return None
    left, right = pair
    separator = next((e for e in edges if e > right + 1), None)

    # The framed fields of the right-hand column, found by their horizontal rules:
    # a rule is an unbroken dark run tens of millimetres long, while the characters
    # inside a field break into runs of a millimetre or two.
    def long_runs(y, x_from):
        out, start = [], None
        for x in range(x_from, w):
            if px[y * w + x] < DARK:
                if start is None:
                    start = x
            elif start is not None:
                if (x - start) * MM_PER_PX > 8:
                    out.append((start, x - 1))
                start = None
        return out

    field_edges = {}
    for y in range(int(0.02 * h), int(0.62 * h)):
        for x0, x1 in long_runs(y, int(right) + 3):
            key = (round(x0 * MM_PER_PX, 0), round(x1 * MM_PER_PX, 0))
            field_edges.setdefault(key, []).append(y)

    # Each field shows as one x-span appearing at two y values: its top and bottom rule.
    fields = []
    for (x0mm, x1mm), ys in field_edges.items():
        if len(ys) < 2:
            continue
        groups, run = [], [ys[0]]
        for y in ys[1:]:
            if y - run[-1] <= 2:
                run.append(y)
            else:
                groups.append(sum(run) / len(run))
                run = [y]
        groups.append(sum(run) / len(run))
        # Fields sharing an x-span — "шифра плаћања" and "модел" have the same width —
        # arrive as one entry with several rules, in top/bottom pairs.
        for i in range(0, len(groups) - 1, 2):
            fields.append({
                'x': x0mm - block_left_mm,
                'w': x1mm - x0mm,
                'y': groups[i] * MM_PER_PX,
                'h': (groups[i + 1] - groups[i]) * MM_PER_PX,
            })

    return {
        'fields': sorted(fields, key=lambda f: (round(f['y'], 1), f['x'])),
        'file': pdf.name,
        'page_mm': (w * MM_PER_PX, h * MM_PER_PX),
        'block_left': left * MM_PER_PX,
        'block_right': right * MM_PER_PX,
        'block_width': (right - left) * MM_PER_PX,
        'rules_mm': [r * MM_PER_PX for r in block_rules],
        'block_height': (block_rules[1] - block_rules[0]) * MM_PER_PX,
        'block_pitch': (block_rules[2] - block_rules[0]) * MM_PER_PX,
        'separator_gap': (separator - right) * MM_PER_PX if separator else None,
    }


if __name__ == '__main__':
    paths = [Path(p) for p in sys.argv[1:]] or sorted(Path('references/scans').glob('*.pdf'))
    results = [m for m in (measure(p) for p in paths) if m]
    if not results:
        print('nothing could be measured')
        raise SystemExit(1)

    print(f"{'scan':26s} {'block w':>8s} {'block h':>8s} {'pitch':>7s} {'sep gap':>7s}  rules (mm from image top)")
    for m in results:
        rules = ' '.join(f'{r:.2f}' for r in m['rules_mm'])
        gap = f"{m['separator_gap']:.2f}" if m['separator_gap'] else '  -  '
        print(f"{m['file']:26s} {m['block_width']:8.2f} {m['block_height']:8.2f} "
              f"{m['block_pitch']:7.2f} {gap:>7s}  {rules}")

    def mean(key):
        return sum(m[key] for m in results) / len(results)

    print('\nframed fields, relative to the first block rule (mm):')
    for m in results:
        if not m['fields']: continue
        base = m['rules_mm'][0]
        desc = ' | '.join(
            f"x {f['x']:6.2f} w {f['w']:5.2f} y {f['y']-base:+6.2f} h {f['h']:4.2f}"
            for f in m['fields'])
        print(f"  {m['file'][:22]:22s} {desc}")

    gaps = [m['separator_gap'] for m in results if m['separator_gap']]
    print(f"\nmean block width {mean('block_width'):.2f} mm, "
          f"height {mean('block_height'):.2f} mm, pitch {mean('block_pitch'):.2f} mm, "
          f"separator gap {sum(gaps)/len(gaps):.2f} mm")
    print("pausal reference:  89.75 /  13.96 /  19.45 /  5.98 mm")
