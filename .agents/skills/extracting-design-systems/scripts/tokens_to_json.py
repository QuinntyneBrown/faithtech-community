#!/usr/bin/env python3
"""Export tokens.css to a W3C Design Tokens (DTCG) JSON file.

Reads the ``:root`` scope and every theme block (``[data-theme="x"]`` or
``prefers-color-scheme``) from a tokens.css file and writes nested JSON where
``--color-bg-canvas`` becomes ``color.bg.canvas``. A value that is exactly one
``var(--other)`` reference is exported as a DTCG alias (``"{palette.gray.50}"``);
everything else is exported resolved. Theme overrides live under
``$extensions["com.agent-toolkit.themes"]``.

Usage:
    python tokens_to_json.py docs/design-system/tokens/tokens.css
    python tokens_to_json.py tokens.css --out tokens.json

The companion ``check_contrast.py`` must sit next to this script.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_contrast import effective_scope, parse_themes, resolve  # noqa: E402

SINGLE_VAR_RE = re.compile(r"^var\(\s*(--[\w-]+)\s*\)$")
TYPE_RULES = [
    (("color", "palette"), "color"),
    (("font-family",), "fontFamily"),
    (("font-weight",), "fontWeight"),
    (("font-size", "space", "radius", "border-width", "layout", "target", "focus-ring", "control-height", "letter-spacing"), "dimension"),
    (("line-height", "z", "layout-columns"), "number"),
    (("duration",), "duration"),
    (("ease",), "cubicBezier"),
    (("shadow",), "shadow"),
    (("text",), "typography"),
]


def token_type(name: str, value: str) -> str:
    bare = name[2:]
    if bare == "layout-columns" or bare.startswith("z-") or bare.startswith("line-height"):
        return "number"
    for prefixes, kind in TYPE_RULES:
        if any(bare == p or bare.startswith(p + "-") for p in prefixes):
            return kind
    if re.match(r"^#|^rgb|^hsl", value):
        return "color"
    if re.match(r"^-?\d*\.?\d+(px|rem|em|%)$", value):
        return "dimension"
    if re.match(r"^-?\d*\.?\d+$", value):
        return "number"
    return "string"


def alias_or_value(raw: str, scope: dict[str, str]) -> tuple[str, str]:
    """Return (alias-or-resolved value, resolved value)."""
    resolved = resolve(raw, scope)
    match = SINGLE_VAR_RE.match(raw.strip())
    if match:
        return ("{" + match.group(1)[2:].replace("-", ".", 1).replace("-", ".") + "}", resolved)
    return (resolved, resolved)


def coerce(kind: str, value: str):
    if kind == "number":
        try:
            return float(value) if "." in value else int(value)
        except ValueError:
            return value
    if kind == "cubicBezier":
        match = re.match(r"cubic-bezier\(([^)]*)\)", value)
        if match:
            return [float(p) for p in match.group(1).split(",")]
    if kind == "fontFamily":
        return [p.strip().strip('"').strip("'") for p in value.split(",")]
    return value


def build(css_path: Path) -> dict:
    themes = parse_themes(css_path.read_text(encoding="utf-8"))
    light = effective_scope(themes, "light")
    others = [t for t in themes if t != "light"]
    scopes = {t: effective_scope(themes, t) for t in others}
    tree: dict = {"$description": f"Exported from {css_path.name}. Light values are the defaults; theme overrides are under $extensions."}
    for name, raw in light.items():
        if not name.startswith("--"):
            continue
        parts = name[2:].split("-")
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        leaf = node.setdefault(parts[-1], {})
        try:
            value, resolved = alias_or_value(raw, light)
        except (KeyError, ValueError) as exc:
            print(f"warning: cannot resolve {name}: {exc}", file=sys.stderr)
            continue
        kind = token_type(name, resolved)
        leaf["$type"] = kind
        leaf["$value"] = coerce(kind, value) if not value.startswith("{") else value
        ext = {"css": name}
        if value != resolved:
            ext["resolved"] = resolved
        overrides = {}
        for theme, scope in scopes.items():
            if name in themes[theme]:
                try:
                    tvalue, tresolved = alias_or_value(themes[theme][name], scope)
                except (KeyError, ValueError):
                    continue
                overrides[theme] = {"$value": coerce(kind, tvalue) if not tvalue.startswith("{") else tvalue}
                if tvalue != tresolved:
                    overrides[theme]["resolved"] = tresolved
        if overrides:
            ext["themes"] = overrides
        leaf["$extensions"] = {"com.agent-toolkit": ext}
    return tree


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tokens_css", type=Path)
    parser.add_argument("--out", type=Path, help="Write here instead of tokens.json beside the CSS")
    args = parser.parse_args(argv)
    if not args.tokens_css.is_file():
        print(f"error: {args.tokens_css} not found", file=sys.stderr)
        return 2
    tree = build(args.tokens_css)
    out = args.out or args.tokens_css.with_name("tokens.json")
    out.write_text(json.dumps(tree, indent=2) + "\n", encoding="utf-8")
    count = sum(1 for _ in re.finditer(r'"\$value"', out.read_text(encoding="utf-8")))
    print(f"wrote {out} ({count} tokens)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
