#!/usr/bin/env python3
"""Check WCAG contrast ratios for token pairs declared in a tokens.css file.

The script resolves CSS custom properties per theme (``:root`` plus every
``[data-theme="..."]`` block), composites translucent colours over their
background, computes the WCAG 2.x contrast ratio for each declared pair, and
fails when any pair is below its minimum. Only the standard library is used.

Usage:
    python check_contrast.py docs/design-system/tokens/tokens.css
    python check_contrast.py tokens.css --pairs contrast-pairs.json --json

Pairs file (JSON):
    {
      "pairs": [
        {"fg": "--color-fg-default", "bg": "--color-bg-surface", "min": 4.5, "note": "body text"},
        {"fg": "--color-border-strong", "bg": "--color-bg-surface", "min": 3, "note": "input borders"}
      ]
    }

``fg`` and ``bg`` may be token names (``--color-...``) or literal colours.
``min`` defaults to 4.5. A pair may carry ``"themes": ["light"]`` to restrict
the check. When no pairs file is given the script looks for
``contrast-pairs.json`` next to the CSS file.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

DECL_RE = re.compile(r"(--[\w-]+)\s*:\s*([^;]+);")
VAR_RE = re.compile(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)")
THEME_RE = re.compile(r"data-theme\s*=\s*[\"']?([\w-]+)[\"']?")
SCHEME_RE = re.compile(r"prefers-color-scheme\s*:\s*(light|dark)")
HEX_RE = re.compile(r"^#([0-9a-fA-F]{3,8})$")
FUNC_RE = re.compile(r"^(rgba?|hsla?)\(([^)]*)\)$", re.I)
NAMED = {
    "white": (255, 255, 255, 1.0),
    "black": (0, 0, 0, 1.0),
    "transparent": (0, 0, 0, 0.0),
}


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def iter_rules(css: str):
    """Yield (media_stack, selector, body) for every style rule, honouring nesting."""
    stack: list[str] = []
    pos = 0
    buffer = ""
    while pos < len(css):
        ch = css[pos]
        if ch == "{":
            prelude = buffer.strip()
            buffer = ""
            if prelude.startswith("@"):
                stack.append(prelude)
                pos += 1
                continue
            depth, end = 1, pos + 1
            while end < len(css) and depth:
                if css[end] == "{":
                    depth += 1
                elif css[end] == "}":
                    depth -= 1
                end += 1
            yield (tuple(stack), prelude, css[pos + 1:end - 1])
            pos = end
            continue
        if ch == "}":
            if stack:
                stack.pop()
            buffer = ""
            pos += 1
            continue
        buffer += ch
        pos += 1


def parse_themes(css: str) -> dict[str, dict[str, str]]:
    """Return {theme: {token: raw value}}.

    ``light`` is the ``:root`` scope. A ``[data-theme="x"]`` selector defines
    theme ``x``. Rules inside ``@media (prefers-color-scheme: dark)`` without an
    explicit data-theme are merged into ``dark``. Rules under other media
    queries (``min-width``, ``prefers-contrast``, ``forced-colors``) are ignored
    because they do not define a colour theme.
    """
    themes: dict[str, dict[str, str]] = {"light": {}}
    for media, selector, body in iter_rules(strip_comments(css)):
        if any(not SCHEME_RE.search(m) for m in media if m.startswith("@media")):
            continue
        if any(m.startswith("@") and not m.startswith("@media") for m in media):
            continue
        match = THEME_RE.search(re.sub(r":not\([^)]*\)", "", selector))
        if match:
            theme = match.group(1)
        else:
            scheme = next((SCHEME_RE.search(m).group(1) for m in media if SCHEME_RE.search(m)), None)
            if scheme:
                theme = scheme
            elif ":root" in selector or selector == "html":
                theme = "light"
            else:
                continue
        bucket = themes.setdefault(theme, {})
        for name, value in DECL_RE.findall(body):
            bucket[name] = value.strip()
    return themes


def resolve(value: str, scope: dict[str, str], seen: tuple[str, ...] = ()) -> str:
    """Expand var() references recursively within one theme scope."""
    def repl(match: re.Match[str]) -> str:
        name, fallback = match.group(1), match.group(2)
        if name in seen:
            raise ValueError(f"Circular token reference through {name}")
        if name in scope:
            return resolve(scope[name], scope, seen + (name,))
        if fallback is not None:
            return resolve(fallback.strip(), scope, seen + (name,))
        raise KeyError(name)
    return VAR_RE.sub(repl, value).strip()


def parse_color(text: str) -> tuple[float, float, float, float]:
    """Return (r, g, b, alpha) with channels 0-255."""
    text = text.strip().lower()
    if text in NAMED:
        return NAMED[text]
    hex_match = HEX_RE.match(text)
    if hex_match:
        digits = hex_match.group(1)
        if len(digits) in (3, 4):
            digits = "".join(ch * 2 for ch in digits)
        if len(digits) not in (6, 8):
            raise ValueError(f"Unsupported hex colour: {text}")
        r, g, b = (int(digits[i:i + 2], 16) for i in (0, 2, 4))
        a = int(digits[6:8], 16) / 255 if len(digits) == 8 else 1.0
        return (r, g, b, a)
    func = FUNC_RE.match(text)
    if not func:
        raise ValueError(f"Unsupported colour syntax: {text}")
    kind, body = func.group(1), func.group(2)
    parts = [p for p in re.split(r"[,\s/]+", body.strip()) if p]
    if len(parts) not in (3, 4):
        raise ValueError(f"Unsupported colour syntax: {text}")
    alpha = 1.0
    if len(parts) == 4:
        alpha = float(parts[3].rstrip("%")) / (100 if parts[3].endswith("%") else 1)
    if kind.startswith("rgb"):
        channels = []
        for part in parts[:3]:
            channels.append(float(part.rstrip("%")) * 2.55 if part.endswith("%") else float(part))
        return (channels[0], channels[1], channels[2], alpha)
    h = float(parts[0].rstrip("deg")) % 360
    s = float(parts[1].rstrip("%")) / 100
    l = float(parts[2].rstrip("%")) / 100
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    sector = int(h // 60)
    r1, g1, b1 = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][sector]
    return ((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255, alpha)


def composite(fg: tuple[float, float, float, float], bg: tuple[float, float, float, float]) -> tuple[float, float, float]:
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3))  # type: ignore[return-value]


def luminance(rgb: tuple[float, float, float]) -> float:
    def channel(value: float) -> float:
        v = value / 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (channel(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: tuple[float, float, float], bg: tuple[float, float, float]) -> float:
    l1, l2 = luminance(fg), luminance(bg)
    light, dark = max(l1, l2), min(l1, l2)
    return (light + 0.05) / (dark + 0.05)


def to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{int(round(v)):02x}" for v in rgb)


def lookup(token_or_colour: str, scope: dict[str, str]) -> str:
    if token_or_colour.startswith("--"):
        if token_or_colour not in scope:
            raise KeyError(token_or_colour)
        return resolve(scope[token_or_colour], scope)
    return resolve(token_or_colour, scope)


def effective_scope(themes: dict[str, dict[str, str]], theme: str) -> dict[str, str]:
    scope = dict(themes.get("light", {}))
    if theme != "light":
        scope.update(themes[theme])
    return scope


def check(css_path: Path, pairs_path: Path | None, only_themes: list[str] | None) -> tuple[list[dict], list[str]]:
    css = css_path.read_text(encoding="utf-8")
    themes = parse_themes(css)
    if pairs_path is None:
        pairs_path = css_path.with_name("contrast-pairs.json")
    if not pairs_path.is_file():
        raise FileNotFoundError(f"Pairs file not found: {pairs_path}")
    pairs = json.loads(pairs_path.read_text(encoding="utf-8")).get("pairs", [])
    if not pairs:
        raise ValueError(f"No pairs declared in {pairs_path}")
    rows: list[dict] = []
    errors: list[str] = []
    theme_names = [t for t in themes if not only_themes or t in only_themes]
    for theme in theme_names:
        scope = effective_scope(themes, theme)
        for pair in pairs:
            if pair.get("themes") and theme not in pair["themes"]:
                continue
            minimum = float(pair.get("min", 4.5))
            try:
                bg_rgba = parse_color(lookup(pair["bg"], scope))
                fg_rgba = parse_color(lookup(pair["fg"], scope))
            except KeyError as exc:
                errors.append(f"[{theme}] unknown token {exc} in pair {pair.get('fg')} on {pair.get('bg')}")
                continue
            except ValueError as exc:
                errors.append(f"[{theme}] {exc} in pair {pair.get('fg')} on {pair.get('bg')}")
                continue
            bg_rgb = composite(bg_rgba, (255, 255, 255, 1.0)) if bg_rgba[3] < 1 else bg_rgba[:3]
            fg_rgb = composite(fg_rgba, (*bg_rgb, 1.0))
            ratio = contrast_ratio(fg_rgb, bg_rgb)
            passed = ratio + 1e-9 >= minimum
            rows.append({
                "theme": theme,
                "fg": pair["fg"],
                "bg": pair["bg"],
                "fg_hex": to_hex(fg_rgb),
                "bg_hex": to_hex(bg_rgb),
                "ratio": round(ratio, 2),
                "min": minimum,
                "pass": passed,
                "note": pair.get("note", ""),
            })
            if not passed:
                errors.append(
                    f"[{theme}] {pair['fg']} ({to_hex(fg_rgb)}) on {pair['bg']} ({to_hex(bg_rgb)}): "
                    f"{ratio:.2f}:1 < {minimum}:1 {pair.get('note', '')}".rstrip()
                )
    return rows, errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tokens_css", type=Path, help="Path to tokens.css")
    parser.add_argument("--pairs", type=Path, help="JSON file of fg/bg pairs (default: contrast-pairs.json beside the CSS)")
    parser.add_argument("--theme", action="append", help="Only check this theme (repeatable)")
    parser.add_argument("--json", action="store_true", help="Print results as JSON")
    args = parser.parse_args(argv)
    try:
        rows, errors = check(args.tokens_css, args.pairs, args.theme)
    except (FileNotFoundError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps({"results": rows, "errors": errors}, indent=2))
    else:
        width = max((len(r["fg"]) for r in rows), default=10)
        bwidth = max((len(r["bg"]) for r in rows), default=10)
        current = None
        for row in rows:
            if row["theme"] != current:
                current = row["theme"]
                print(f"\nTheme: {current}")
            status = "PASS" if row["pass"] else "FAIL"
            print(f"  {status} {row['ratio']:>6.2f}:1 (min {row['min']:g}) {row['fg']:<{width}} on {row['bg']:<{bwidth}} {row['note']}")
        print()
        failures = [r for r in rows if not r["pass"]]
        print(f"{len(rows) - len(failures)} passed, {len(failures)} failed, {len(errors) - len(failures)} unresolved")
    if errors:
        for err in errors:
            print(f"FAIL {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
