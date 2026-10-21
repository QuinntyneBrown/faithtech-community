#!/usr/bin/env python3
"""Validate a docs/design-system tree: structure, sections, tokens-only colour, links.

Checks performed:
  * required files exist: index.html, README.md, tokens/tokens.css,
    tokens/contrast-pairs.json, assets/components.css, and one page per
    required foundation under foundations/.
  * every HTML page has a doctype, <html lang>, <title>, viewport meta, exactly
    one <h1>, a <main> landmark and links tokens/tokens.css.
  * every component page under components/ (and every pattern page under
    patterns/) contains the required <section id="..."> blocks in order, or
    marks a section not applicable with data-na="reason".
  * no raw colour literals (hex, rgb(), hsl()) appear in page styles,
    style attributes or assets/*.css: everything must go through tokens.
    Append /* allow-color */ on a line to exempt it deliberately.
  * images have alt text, form controls have labels, buttons and links have an
    accessible name, every relative link/asset resolves (including fragments),
    and index.html and README.md link every foundation, component and pattern.

Usage:
    python check_design_system.py                      # checks docs/design-system
    python check_design_system.py docs/design-system --json

Exit status is 1 when any error is found. Only the standard library is used.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

REQUIRED_FILES = ["index.html", "README.md", "tokens/tokens.css", "tokens/contrast-pairs.json", "assets/components.css"]
REQUIRED_FOUNDATIONS = ["color", "typography", "spacing", "layout", "elevation", "shape", "motion", "iconography", "theming", "responsive", "accessibility", "content"]
COMPONENT_SECTIONS = ["overview", "anatomy", "variants", "sizes", "states", "responsive", "theming", "accessibility", "content", "do-dont", "tokens", "code", "sources"]
PATTERN_SECTIONS = ["overview", "when", "structure", "states", "responsive", "accessibility", "content", "do-dont", "sources"]
COLOR_LITERAL_RE = re.compile(r"#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?<![\w-])(?:rgb|hsl)a?\(|(?<![\w-])(?:white|black)(?![\w-])", re.I)
ALLOW_MARK = "allow-color"
EXEMPT_INPUT_TYPES = {"hidden", "submit", "button", "reset", "image"}


class PageInspector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.doctype = False
        self.lang = None
        self.title = ""
        self.in_title = False
        self.viewport = False
        self.h1_count = 0
        self.main = False
        self.stylesheets: list[str] = []
        self.refs: list[tuple[str, int]] = []
        self.ids: set[str] = set()
        self.sections: list[tuple[str, str | None, int]] = []  # (id, data-na, line)
        self.style_blocks: list[tuple[int, str]] = []
        self.inline_styles: list[tuple[int, str]] = []
        self.in_style = False
        self.in_script = 0
        self.label_for: set[str] = set()
        self.label_depth = 0
        self.unlabelled: list[tuple[str, int]] = []
        self.images_without_alt: list[int] = []
        self.unnamed: list[tuple[str, int]] = []
        self._open: list[dict] = []

    def handle_decl(self, decl):
        if decl.lower().startswith("doctype"):
            self.doctype = True

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        line = self.getpos()[0]
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "html":
            self.lang = attrs.get("lang")
        elif tag == "title":
            self.in_title = True
        elif tag == "meta" and (attrs.get("name") or "").lower() == "viewport":
            self.viewport = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "main":
            self.main = True
        elif tag == "style":
            self.in_style = True
        elif tag == "script":
            self.in_script += 1
        elif tag == "section" and attrs.get("id"):
            self.sections.append((attrs["id"], attrs.get("data-na"), line))
        elif tag == "link":
            if "stylesheet" in (attrs.get("rel") or ""):
                self.stylesheets.append(attrs.get("href", ""))
            if attrs.get("href") and "icon" not in (attrs.get("rel") or ""):
                self.refs.append((attrs["href"], line))
        elif tag == "a" and attrs.get("href"):
            self.refs.append((attrs["href"], line))
        elif tag in {"img", "script", "iframe", "source"} and attrs.get("src"):
            self.refs.append((attrs["src"], line))
        if tag == "img" and "alt" not in attrs:
            self.images_without_alt.append(line)
        if tag == "img" and attrs.get("alt"):
            for el in self._open:
                el["named"] = True
        if attrs.get("style"):
            self.inline_styles.append((line, attrs["style"]))
        if tag in {"a", "button"}:
            self._open.append({"tag": tag, "line": line, "named": bool(attrs.get("aria-label") or attrs.get("aria-labelledby") or attrs.get("title")), "text": ""})
        elif attrs.get("aria-label") and self._open:
            self._open[-1]["named"] = True
        if tag == "label":
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
            self.label_depth += 1
        if tag in {"input", "select", "textarea"}:
            if not (tag == "input" and (attrs.get("type") or "text").lower() in EXEMPT_INPUT_TYPES):
                if not (attrs.get("aria-label") or attrs.get("aria-labelledby") or self.label_depth):
                    self.unlabelled.append((attrs.get("id") or f"<{tag}>", line))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag == "script":
            self.in_script -= 1

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "style":
            self.in_style = False
        elif tag == "script":
            self.in_script = max(0, self.in_script - 1)
        elif tag == "label":
            self.label_depth = max(0, self.label_depth - 1)
        elif tag in {"a", "button"}:
            for i in range(len(self._open) - 1, -1, -1):
                if self._open[i]["tag"] == tag:
                    el = self._open.pop(i)
                    if not el["named"] and not el["text"].strip():
                        self.unnamed.append((tag, el["line"]))
                    break

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.in_style:
            self.style_blocks.append((self.getpos()[0], data))
        if self.in_script or self.in_style:
            return
        for el in self._open:
            el["text"] += data

    def finish(self) -> None:
        self.unlabelled = [(ident, line) for ident, line in self.unlabelled if ident not in self.label_for]


def inspect(path: Path) -> PageInspector:
    parser = PageInspector()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    parser.close()
    parser.finish()
    return parser


def colour_literals(css: str, first_line: int) -> list[tuple[int, str]]:
    hits = []
    for offset, line in enumerate(css.splitlines()):
        if ALLOW_MARK in line:
            continue
        stripped = re.sub(r"/\*.*?\*/", "", line)
        # Ignore literals that only appear inside url(...) or as part of a token *name*.
        stripped = re.sub(r"url\([^)]*\)", "", stripped)
        stripped = re.sub(r"--[\w-]+", "", stripped)
        for match in COLOR_LITERAL_RE.finditer(stripped):
            hits.append((first_line + offset, match.group(0)))
    return hits


def check_reference(source: Path, target: str, ids_cache: dict[Path, set[str]]) -> str | None:
    parts = urlsplit(target)
    if parts.scheme or target.startswith(("//", "mailto:", "tel:", "data:", "javascript:")):
        return None
    if not parts.path and not parts.fragment:
        return None
    candidate = (source.parent / unquote(parts.path)).resolve() if parts.path else source.resolve()
    if candidate.is_dir():
        candidate = candidate / "index.html"
    if not candidate.exists():
        return f"broken reference '{target}'"
    if parts.fragment and candidate.suffix.lower() in {".html", ".htm"} and parts.fragment != "top":
        if candidate not in ids_cache:
            ids_cache[candidate] = inspect(candidate).ids
        if parts.fragment not in ids_cache[candidate]:
            return f"missing fragment '#{parts.fragment}' in '{target}'"
    return None


def markdown_links(text: str) -> set[str]:
    return {unquote(urlsplit(m).path) for m in re.findall(r"\]\(([^)\s]+)", text)}


def run_checks(root: Path) -> tuple[list[str], list[str], dict]:
    errors: list[str] = []
    warnings: list[str] = []
    ids_cache: dict[Path, set[str]] = {}
    for rel in REQUIRED_FILES:
        if not (root / rel).is_file():
            errors.append(f"missing required file {rel}")
    for name in REQUIRED_FOUNDATIONS:
        if not (root / "foundations" / f"{name}.html").is_file():
            errors.append(f"missing foundation page foundations/{name}.html")
    pages = sorted(p for p in root.rglob("*.html") if ".cache" not in p.parts)
    components = sorted((root / "components").glob("*.html")) if (root / "components").is_dir() else []
    patterns = sorted((root / "patterns").glob("*.html")) if (root / "patterns").is_dir() else []
    if not components:
        errors.append("components/ has no component pages")

    for page in pages:
        rel = page.relative_to(root).as_posix()
        doc = inspect(page)
        if not doc.doctype:
            errors.append(f"{rel}: missing <!doctype html>")
        if not doc.lang:
            errors.append(f"{rel}: <html> has no lang attribute")
        if not doc.title.strip():
            errors.append(f"{rel}: missing <title>")
        if not doc.viewport:
            errors.append(f"{rel}: missing viewport meta")
        if doc.h1_count != 1:
            errors.append(f"{rel}: expected exactly one <h1>, found {doc.h1_count}")
        if not doc.main:
            errors.append(f"{rel}: missing <main> landmark")
        if not any(h.endswith("tokens.css") for h in doc.stylesheets):
            errors.append(f"{rel}: does not link tokens/tokens.css")
        for line in doc.images_without_alt:
            errors.append(f"{rel}:{line}: <img> without alt attribute")
        for ident, line in doc.unlabelled:
            errors.append(f"{rel}:{line}: form control {ident} has no label")
        for tag, line in doc.unnamed:
            errors.append(f"{rel}:{line}: <{tag}> has no accessible name")
        for target, line in doc.refs:
            problem = check_reference(page, target, ids_cache)
            if problem:
                errors.append(f"{rel}:{line}: {problem}")
        for first_line, css in doc.style_blocks:
            for line, literal in colour_literals(css, first_line):
                errors.append(f"{rel}:{line}: raw colour '{literal}' in <style>; use a token (or mark the line /* allow-color */)")
        for line, css in doc.inline_styles:
            for _, literal in colour_literals(css, line):
                errors.append(f"{rel}:{line}: raw colour '{literal}' in style attribute; use a token")
        required = COMPONENT_SECTIONS if page in components else PATTERN_SECTIONS if page in patterns else None
        if required:
            found = [sid for sid, _, _ in doc.sections]
            for sid in required:
                if sid not in found:
                    errors.append(f"{rel}: missing <section id=\"{sid}\"> (mark it data-na=\"reason\" if it does not apply)")
            for sid, na, line in doc.sections:
                if na is not None and not na.strip():
                    errors.append(f"{rel}:{line}: section '{sid}' has an empty data-na reason")
            order = [sid for sid in found if sid in required]
            expected_order = [sid for sid in required if sid in found]
            if order != expected_order:
                warnings.append(f"{rel}: sections are out of the standard order ({', '.join(order)})")

    assets = root / "assets"
    if assets.is_dir():
        for css in sorted(assets.glob("*.css")):
            for line, literal in colour_literals(css.read_text(encoding="utf-8", errors="replace"), 1):
                errors.append(f"assets/{css.name}:{line}: raw colour '{literal}'; use a token (or mark the line /* allow-color */)")

    catalog = [p for p in pages if p.parent.name in {"foundations", "components", "patterns"}]
    index = root / "index.html"
    if index.is_file():
        linked = {(index.parent / unquote(urlsplit(t).path)).resolve() for t, _ in inspect(index).refs if urlsplit(t).path}
        for page in catalog:
            if page.resolve() not in linked:
                errors.append(f"index.html does not link {page.relative_to(root).as_posix()}")
    readme = root / "README.md"
    if readme.is_file():
        links = {(root / l).resolve() for l in markdown_links(readme.read_text(encoding="utf-8"))}
        for page in catalog:
            if page.resolve() not in links:
                errors.append(f"README.md does not link {page.relative_to(root).as_posix()}")
        for target in markdown_links(readme.read_text(encoding="utf-8")):
            if target and not urlsplit(target).scheme and not (root / target).exists():
                errors.append(f"README.md: broken link '{target}'")
    summary = {"pages": len(pages), "components": len(components), "patterns": len(patterns)}
    return errors, warnings, summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("root", nargs="?", default="docs/design-system", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    if not args.root.is_dir():
        print(f"error: {args.root} is not a directory", file=sys.stderr)
        return 2
    errors, warnings, summary = run_checks(args.root)
    if args.json:
        print(json.dumps({"errors": errors, "warnings": warnings, **summary}, indent=2))
    else:
        for w in warnings:
            print(f"WARN  {w}")
        for e in errors:
            print(f"ERROR {e}")
        print(f"\n{summary['pages']} pages ({summary['components']} components, {summary['patterns']} patterns), {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
