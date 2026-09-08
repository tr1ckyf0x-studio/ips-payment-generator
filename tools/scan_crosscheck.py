"""Cross-checks the layout spec against a photographed OPTIMUM blank.

The scans are photos: cropped by an unknown amount and slightly rotated, so their
absolute millimetre positions mean nothing. What survives those distortions are ratios
between distances, and those are what this compares — no deskew or registration needed,
because a fraction of a degree of rotation changes a ratio by less than a thousandth.

Usage:  python3 tools/scan_crosscheck.py references/scans/optimum-2026-09-04.pdf
Writes an overlay PNG next to the scan so the detected rules can be eyeballed.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

# Reference geometry, in millimetres from the top-left of the slip. Mirrors
# src/layout/formSpec.ts; see docs/specs for where the numbers come from.
REF = {
    'block_left': 8.98,
    'block_right': 98.72,
    'separator_x': 104.70,
    'platilac_top': 12.99,
    'platilac_bottom': 26.95,
    'svrha_top': 32.44,
    'svrha_bottom': 46.40,
    'primalac_top': 51.88,
    'primalac_bottom': 65.84,
    'potpis_rule': 72.82,
    'date_rule': 80.80,
}

DPI = 200


def render(pdf: Path) -> tuple[int, int, bytes]:
    with tempfile.TemporaryDirectory() as tmp:
        stem = Path(tmp) / 'page'
        subprocess.run(
            ['pdftoppm', '-gray', '-r', str(DPI), str(pdf), str(stem)],
            check=True, capture_output=True,
        )
        pgm = next(Path(tmp).glob('page*.pgm'), None) or next(Path(tmp).glob('page*.ppm'))
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
    i += 1
    w, h = int(tokens[1]), int(tokens[2])
    return w, h, data[i:i + w * h]


def longest_run(values, dark, gap):
    """Longest run of dark samples, tolerating short light interruptions."""
    best = current = missed = 0
    for v in values:
        if v < dark:
            current += 1
            missed = 0
            best = max(best, current)
        else:
            missed += 1
            if missed > gap:
                current = 0
    return best


def group(indices, min_gap=4):
    out, run = [], []
    for i in indices:
        if run and i - run[-1] > min_gap:
            out.append(sum(run) / len(run))
            run = []
        run.append(i)
    if run:
        out.append(sum(run) / len(run))
    return out


def detect(w, h, px, dark=170, gap=3):
    rows = [y for y in range(h)
            if longest_run(px[y * w:(y + 1) * w], dark, gap) >= 0.25 * w]
    cols = [x for x in range(w)
            if longest_run([px[y * w + x] for y in range(h)], dark, gap) >= 0.10 * h]
    return group(rows), group(cols)


def overlay(path: Path, w: int, h: int, px: bytes, rows, cols):
    """Writes a PPM with detected rules marked, for visual confirmation."""
    buf = bytearray()
    row_set = {int(round(r)) for r in rows}
    col_set = {int(round(c)) for c in cols}
    for y in range(h):
        for x in range(w):
            v = px[y * w + x]
            if y in row_set:
                buf += bytes((255, 0, 0))
            elif x in col_set:
                buf += bytes((0, 128, 255))
            else:
                buf += bytes((v, v, v))
    path.write_bytes(b'P6\n%d %d\n255\n' % (w, h) + bytes(buf))


def main(pdf_path: str):
    pdf = Path(pdf_path)
    w, h, px = render(pdf)
    rows, cols = detect(w, h, px)

    out = Path('.visual') / f'{pdf.stem}-overlay.ppm'
    out.parent.mkdir(exist_ok=True)
    overlay(out, w, h, px, rows, cols)

    print(f'{pdf.name}: {w}x{h}px at {DPI}dpi = {w / DPI * 25.4:.1f} x {h / DPI * 25.4:.1f} mm')
    print(f'horizontal rules (px): {" ".join(f"{r:.1f}" for r in rows)}')
    print(f'vertical rules   (px): {" ".join(f"{c:.1f}" for c in cols)}')

    if len(cols) >= 3:
        left, right, separator = cols[0], cols[1], cols[2]
        block_width = right - left
        measured = (separator - left) / block_width
        expected = ((REF['separator_x'] - REF['block_left'])
                    / (REF['block_right'] - REF['block_left']))
        # Scale the deviation back into millimetres of the reference block.
        drift = (measured - expected) * (REF['block_right'] - REF['block_left'])
        print()
        print('separator position, as a fraction of the block width:')
        print(f'  scan {measured:.5f}   reference {expected:.5f}'
              f'   deviation {(measured / expected - 1) * 100:+.2f}% = {drift:+.2f} mm')
        print(f'  scan covers {w * (REF["block_right"] - REF["block_left"]) / block_width:.1f} mm'
              f' of the 210 mm blank, the rest cropped away by the camera')

    print()
    print('Horizontal rules are not compared: the photographs are rotated by a fraction')
    print('of a degree, which breaks a 90 mm rule into pieces and lets text register as')
    print('a rule. The verticals are short enough to survive it.')
    print(f'\noverlay written to {out}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'references/scans/optimum-2026-09-04.pdf')
