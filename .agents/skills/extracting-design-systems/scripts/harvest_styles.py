#!/usr/bin/env python3
"""Harvest the visual vocabulary used by HTML mocks so it can become tokens.

Scans a folder of HTML and CSS files (default ``docs/mocks``) and reports every
distinct colour, font family, font size, weight, line height, spacing value,
radius, shadow, border width, duration, z-index, breakpoint and custom property
it finds, with how often and where each appears. Spacing and size values are
annotated with the nearest step on a 4px scale so deviations stand out.

Usage:
    python harvest_styles.py docs/mocks                 # Markdown report to stdout
    python harvest_styles.py docs/mocks --json > out.json
    python harvest_styles.py docs/mocks --min-count 2   # hide one-off values

Only the standard library is used.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

COLOR_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgb|hsl)a?\([^)]*\)|\b(?:white|black|transparent|currentColor)\b", re.I)
DECL_RE = re.compile(r"([\w-]+)\s*:\s*([^;{}]+)")
MEDIA_RE = re.compile(r"@media[^{]*\((?:min|max)-width\s*:\s*([^)]+)\)")
VAR_DEF_RE = re.compile(r"(--[\w-]+)\s*:\s*([^;{}]+)")
LENGTH_RE = re.compile(r"-?\d*\.?\d+(?:px|rem|em|%|vw|vh|ch)\b|\b0\b")
DURATION_RE = re.compile(r"\d*\.?\d+m?s\b")

SPACING_PROPS = {"margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block",
                 "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block",
                 "gap", "row-gap", "column-gap", "inset", "top", "right", "bottom", "left"}
SIZE_PROPS = {"width", "height", "min-width", "min-height", "max-width", "max-height", "inline-size", "block-size"}
COLOR_PROPS = {"color", "background", "background-color", "border", "border-color", "border-top", "border-right",
               "border-bottom", "border-left", "outline", "outline-color", "fill", "stroke", "box-shadow", "text-decoration-color", "accent-color", "caret-color"}


class StyleExtractor(HTMLParser):
    """Collect <style> contents and style="" attributes from an HTML file."""

    def __init__(self) -> None:
        super().__init__()
        self.in_style = False
        self.css_blocks: list[str] = []
        self.inline: list[str] = []
        self.class_names: Counter[str] = Counter()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "style":
            self.in_style = True
        if attrs.get("style"):
            self.inline.append(attrs["style"])
        if attrs.get("class"):
            for name in attrs["class"].split():
                self.class_names[name] += 1

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False

    def handle_data(self, data):
        if self.in_style:
            self.css_blocks.append(data)


def strip_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def snap_4px(value: str) -> str:
    """Describe how a length relates to a 4px grid."""
    match = re.match(r"(-?\d*\.?\d+)(px|rem|em)", value)
    if not match:
        return ""
    number, unit = float(match.group(1)), match.group(2)
    px = number if unit == "px" else number * 16
    if px == 0:
        return "0"
    step = round(px / 4)
    nearest = step * 4
    if abs(px - nearest) < 0.01:
        return f"= {step}×4px"
    return f"off-grid (nearest {nearest}px)"


def harvest(root: Path, include_classes: bool) -> dict:
    found: dict[str, Counter] = defaultdict(Counter)
    where: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    classes: Counter[str] = Counter()
    files = sorted(p for p in root.rglob("*") if p.suffix.lower() in {".html", ".htm", ".css"} and ".cache" not in p.parts)
    if not files:
        raise FileNotFoundError(f"No .html or .css files under {root}")

    def record(category: str, value: str, file: Path) -> None:
        value = value.strip()
        if not value:
            return
        found[category][value] += 1
        where[category][value].add(file.relative_to(root).as_posix())

    for file in files:
        text = file.read_text(encoding="utf-8", errors="replace")
        css_chunks: list[str] = []
        if file.suffix.lower() == ".css":
            css_chunks.append(text)
        else:
            parser = StyleExtractor()
            parser.feed(text)
            css_chunks.extend(parser.css_blocks)
            css_chunks.extend(f"x{{{s}}}" for s in parser.inline)
            classes.update(parser.class_names)
        css = strip_comments("\n".join(css_chunks))
        for bp in MEDIA_RE.findall(css):
            record("breakpoints", bp.strip(), file)
        for name, value in VAR_DEF_RE.findall(css):
            record("custom-properties", f"{name}: {value.strip()}", file)
        body_only = re.sub(r"(--[\w-]+)\s*:\s*[^;{}]+", "", css)
        for prop, value in DECL_RE.findall(body_only):
            prop, value = prop.lower().strip(), value.strip()
            if prop in COLOR_PROPS or prop.startswith("border") or prop.startswith("background"):
                for colour in COLOR_RE.findall(value):
                    record("colors", colour.lower(), file)
            if prop == "font-family":
                record("font-families", value, file)
            elif prop == "font-size":
                record("font-sizes", value, file)
            elif prop == "font-weight":
                record("font-weights", value, file)
            elif prop == "line-height":
                record("line-heights", value, file)
            elif prop == "letter-spacing":
                record("letter-spacing", value, file)
            elif prop == "font":
                record("font-shorthand", value, file)
            elif prop in SPACING_PROPS:
                for length in LENGTH_RE.findall(value):
                    record("spacing", length, file)
            elif prop in SIZE_PROPS:
                for length in LENGTH_RE.findall(value):
                    record("sizes", length, file)
            elif prop.startswith("border-radius") or prop.endswith("-radius"):
                record("radii", value, file)
            elif prop == "box-shadow" or prop == "text-shadow":
                record("shadows", value, file)
            elif prop in {"border-width", "outline-width"} or (prop.startswith("border") and "width" in prop):
                record("border-widths", value, file)
            elif prop in {"transition", "transition-duration", "animation", "animation-duration"}:
                literal = re.sub(r"var\([^)]*\)", "", value)
                for duration in DURATION_RE.findall(literal):
                    record("durations", duration, file)
                for easing in re.findall(r"cubic-bezier\([^)]*\)|(?<![\w-])(?:ease(?:-in|-out|-in-out)?|linear)(?![\w-])", literal):
                    record("easings", easing, file)
                for token in re.findall(r"var\((--(?:duration|ease)[\w-]*)\)", value):
                    record("motion-tokens", token, file)
            elif prop == "z-index":
                record("z-indexes", value, file)
            elif prop == "opacity":
                record("opacities", value, file)
            elif prop == "max-width" and "ch" in value:
                record("measures", value, file)
            # Colours may also appear in non-colour properties such as outline/fill via shorthand.
            if prop in {"outline", "fill", "stroke"}:
                for colour in COLOR_RE.findall(value):
                    record("colors", colour.lower(), file)

    report = {
        "root": root.as_posix(),
        "files": [f.relative_to(root).as_posix() for f in files],
        "categories": {},
    }
    for category, counter in sorted(found.items()):
        entries = []
        for value, count in counter.most_common():
            entry = {"value": value, "count": count, "files": sorted(where[category][value])}
            if category in {"spacing", "sizes", "font-sizes", "radii"}:
                note = snap_4px(value)
                if note:
                    entry["grid"] = note
            entries.append(entry)
        report["categories"][category] = entries
    if include_classes:
        report["class-names"] = [{"value": name, "count": count} for name, count in classes.most_common()]
    return report


def render_markdown(report: dict, min_count: int) -> str:
    lines = [f"# Style harvest for `{report['root']}`", "", f"Scanned {len(report['files'])} files.", ""]
    for category, entries in report["categories"].items():
        visible = [e for e in entries if e["count"] >= min_count]
        if not visible:
            continue
        lines.append(f"## {category} ({len(entries)} distinct)")
        lines.append("")
        has_grid = any("grid" in e for e in visible)
        header = "| Value | Count | " + ("Grid | " if has_grid else "") + "Files |"
        lines.append(header)
        lines.append("|" + "---|" * (4 if has_grid else 3))
        for e in visible:
            files = ", ".join(e["files"][:4]) + (f" (+{len(e['files']) - 4})" if len(e["files"]) > 4 else "")
            value = e["value"].replace("|", "\\|")
            row = f"| `{value}` | {e['count']} | " + (f"{e.get('grid', '')} | " if has_grid else "") + f"{files} |"
            lines.append(row)
        lines.append("")
    if "class-names" in report:
        lines.append("## class names")
        lines.append("")
        lines.append("| Class | Count |")
        lines.append("|---|---|")
        for e in report["class-names"]:
            if e["count"] >= min_count:
                lines.append(f"| `{e['value']}` | {e['count']} |")
        lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default="docs/mocks", type=Path, help="Folder to scan (default docs/mocks)")
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of Markdown")
    parser.add_argument("--min-count", type=int, default=1, help="Hide values seen fewer times than this (Markdown only)")
    parser.add_argument("--classes", action="store_true", help="Include class-name frequencies (helps find components)")
    args = parser.parse_args(argv)
    try:
        report = harvest(args.root, args.classes)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render_markdown(report, args.min_count))
    return 0


if __name__ == "__main__":
    sys.exit(main())
