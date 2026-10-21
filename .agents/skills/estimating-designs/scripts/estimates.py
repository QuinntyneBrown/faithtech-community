#!/usr/bin/env python3
"""Inventory detailed designs, roll up estimates, and check docs/estimates/.

Usage
-----
    python estimates.py inventory [DESIGNS_DIR] [--json]
    python estimates.py rollup    [ESTIMATES_DIR] [--json]
    python estimates.py check     [DESIGNS_DIR] [ESTIMATES_DIR]

DESIGNS_DIR defaults to ``docs/detailed-designs`` and ESTIMATES_DIR to
``docs/estimates``, both relative to the current directory.

inventory
    Lists every ``{subsystem}/{feature}/README.md`` with its behaviour count
    (``### Behaviour`` headings, or sequence diagrams when there are none),
    distinct L2 requirement IDs, C4 ``Component(...)`` macros, and the
    heuristic baseline of one day per behaviour plus one day of setup.

rollup
    Reads every ``{subsystem}.md`` table and prints each subsystem's summed
    effort and effort-weighted percent complete, plus the overall figures, in
    the exact form the root README uses.

check
    Verifies the estimates against the designs and the rollup. Exit status is
    non-zero when any problem is found, and every problem is listed.

Only the Python 3 standard library is required.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

BEHAVIOUR_HEADING = re.compile(r"^#{2,4}\s+Behaviou?r\b", re.IGNORECASE | re.MULTILINE)
# Plain (L2-001), level-first (L2-INTAKE-001) and domain-first (INTAKE-L2-001).
L2_ID = re.compile(r"\b(?:L2(?:-[A-Z][A-Z0-9]*)?|[A-Z][A-Z0-9]*-L2)-[0-9]+\b")
C4_COMPONENT = re.compile(r"\bComponent(?:Db|Queue)?(?:_Ext)?\s*\(")
TABLE_ROW = re.compile(r"^\s*\|(.+)\|\s*$")
SEPARATOR_ROW = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")
EFFORT_CELL = re.compile(r"^(\d+) (day|days)$")
COMPLETE_CELL = re.compile(r"^(\d{1,3})%$")
LINK_CELL = re.compile(r"^\[([^\]]+)\]\(([^)]+)\)$")
DEFERRED_LINE = "Excludes deferred work (see AGENTS.md)."


def round_half_up(value: float) -> int:
    return int(math.floor(value + 0.5))


def weighted_complete(rows: list[tuple[int, int]]) -> int:
    total = sum(effort for effort, _ in rows)
    if total == 0:
        return 0
    return round_half_up(sum(effort * complete for effort, complete in rows) / total)


def days(n: int) -> str:
    return f"{n} day" if n == 1 else f"{n} days"


# --------------------------------------------------------------------------- designs


def feature_folders(designs: Path) -> dict[str, list[str]]:
    """Map each subsystem folder to its sorted feature folders that hold a README.md."""
    result: dict[str, list[str]] = {}
    for subsystem in sorted(p for p in designs.iterdir() if p.is_dir() and not p.name.startswith(".")):
        features = sorted(
            f.name for f in subsystem.iterdir() if f.is_dir() and (f / "README.md").is_file()
        )
        if features:
            result[subsystem.name] = features
    return result


def is_sequence_diagram(puml: Path) -> bool:
    if "seq" in puml.stem.lower():
        return True
    text = puml.read_text(encoding="utf-8", errors="replace")
    return "!include <C4" not in text and re.search(r"^\s*participant\b", text, re.MULTILINE) is not None


def inspect_feature(folder: Path) -> dict:
    readme = (folder / "README.md").read_text(encoding="utf-8", errors="replace")
    headings = len(BEHAVIOUR_HEADING.findall(readme))
    pumls = sorted((folder / "diagrams").glob("*.puml")) if (folder / "diagrams").is_dir() else []
    sequences = sum(1 for p in pumls if is_sequence_diagram(p))
    components = set()
    for p in pumls:
        text = p.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            if C4_COMPONENT.search(line):
                alias = re.search(r"\(\s*([A-Za-z0-9_]+)", line)
                components.add(alias.group(1) if alias else line.strip())
    behaviours = headings or sequences
    return {
        "behaviours": behaviours,
        "behaviour_source": "headings" if headings else ("sequence diagrams" if sequences else "none"),
        "l2_requirements": len(set(L2_ID.findall(readme))),
        "components": len(components),
        "baseline_days": behaviours + 1,
    }


def cmd_inventory(args: argparse.Namespace) -> int:
    designs = Path(args.designs)
    if not designs.is_dir():
        print(f"error: {designs} does not exist; detailed designs come first", file=sys.stderr)
        return 2
    folders = feature_folders(designs)
    if not folders:
        print(f"error: {designs} holds no {{subsystem}}/{{feature}}/README.md designs", file=sys.stderr)
        return 2
    data = {
        subsystem: {feature: inspect_feature(designs / subsystem / feature) for feature in features}
        for subsystem, features in folders.items()
    }
    if args.json:
        print(json.dumps(data, indent=2))
        return 0
    print("| Subsystem | Design | Behaviours | L2 reqs | Components | Baseline |")
    print("|---|---|---|---|---|---|")
    for subsystem, features in data.items():
        for feature, info in features.items():
            note = "" if info["behaviour_source"] == "headings" else f" ({info['behaviour_source']})"
            print(
                f"| {subsystem} | {feature} | {info['behaviours']}{note} | {info['l2_requirements']} "
                f"| {info['components']} | {days(info['baseline_days'])} |"
            )
    return 0


# --------------------------------------------------------------------------- estimates


def split_row(line: str) -> list[str] | None:
    match = TABLE_ROW.match(line)
    if not match:
        return None
    return [cell.strip() for cell in match.group(1).split("|")]


def parse_subsystem_file(path: Path) -> tuple[list[dict], list[str]]:
    """Return (rows, problems) for one {subsystem}.md file."""
    problems: list[str] = []
    rows: list[dict] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    expected_title = f"# Estimates: {path.stem}"
    content = [(i + 1, line) for i, line in enumerate(lines) if line.strip()]
    if not content or content[0][1].strip() != expected_title:
        problems.append(f"{path}: first line shall be '{expected_title}'")
    header_seen = False
    for number, line in content[1:]:
        cells = split_row(line)
        if cells is None:
            if line.strip() != DEFERRED_LINE:
                problems.append(f"{path}:{number}: unexpected content outside the table: {line.strip()!r}")
            continue
        if SEPARATOR_ROW.match(line):
            continue
        if not header_seen:
            header_seen = True
            if cells != ["Design", "Effort", "Complete"]:
                problems.append(f"{path}:{number}: header shall be '| Design | Effort | Complete |'")
            continue
        if len(cells) != 3:
            problems.append(f"{path}:{number}: expected 3 cells, found {len(cells)}")
            continue
        rows.append(parse_cells(path, number, cells, problems))
    if not header_seen:
        problems.append(f"{path}: no estimates table found")
    return [r for r in rows if r is not None], problems


def parse_cells(path: Path, number: int, cells: list[str], problems: list[str]) -> dict | None:
    name, effort_cell, complete_cell = cells
    effort = EFFORT_CELL.match(effort_cell)
    complete = COMPLETE_CELL.match(complete_cell)
    ok = True
    if not effort:
        problems.append(f"{path}:{number}: effort {effort_cell!r} shall read '{{n}} days' (or '1 day')")
        ok = False
    elif (effort.group(2) == "day") != (int(effort.group(1)) == 1):
        problems.append(f"{path}:{number}: write {days(int(effort.group(1)))!r}, not {effort_cell!r}")
    if not complete or int(complete.group(1)) > 100:
        problems.append(f"{path}:{number}: complete {complete_cell!r} shall be a percentage from 0% to 100%")
        ok = False
    if not ok:
        return None
    return {"name": name, "effort": int(effort.group(1)), "complete": int(complete.group(1))}


def subsystem_files(estimates: Path) -> list[Path]:
    return sorted(p for p in estimates.glob("*.md") if p.name.lower() != "readme.md")


def compute_rollup(estimates: Path) -> tuple[dict, list[str]]:
    problems: list[str] = []
    subsystems = {}
    for path in subsystem_files(estimates):
        rows, file_problems = parse_subsystem_file(path)
        problems.extend(file_problems)
        subsystems[path.stem] = {
            "effort": sum(r["effort"] for r in rows),
            "complete": weighted_complete([(r["effort"], r["complete"]) for r in rows]),
            "rows": rows,
        }
    all_rows = [(r["effort"], r["complete"]) for s in subsystems.values() for r in s["rows"]]
    overall = {"effort": sum(e for e, _ in all_rows), "complete": weighted_complete(all_rows)}
    return {"overall": overall, "subsystems": subsystems}, problems


def cmd_rollup(args: argparse.Namespace) -> int:
    estimates = Path(args.estimates)
    if not estimates.is_dir() or not subsystem_files(estimates):
        print(f"error: no {{subsystem}}.md files in {estimates}; write them first", file=sys.stderr)
        return 2
    rollup, problems = compute_rollup(estimates)
    if args.json:
        print(json.dumps(rollup, indent=2))
    else:
        print(f"- Overall effort: {days(rollup['overall']['effort'])}")
        print(f"- Complete: {rollup['overall']['complete']}%")
        print()
        print("| Subsystem | Effort | Complete |")
        print("|---|---|---|")
        for name, s in rollup["subsystems"].items():
            print(f"| [{name}]({name}.md) | {days(s['effort'])} | {s['complete']}% |")
        print()
        print("Rows are alphabetical; reorder them into delivery order in README.md.")
    for problem in problems:
        print(f"warning: {problem}", file=sys.stderr)
    return 1 if problems else 0


# --------------------------------------------------------------------------- check


def check_root(estimates: Path, rollup: dict) -> list[str]:
    path = estimates / "README.md"
    if not path.is_file():
        return [f"{path}: missing root README"]
    problems: list[str] = []
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "# Estimates":
        problems.append(f"{path}: first line shall be '# Estimates'")

    overall = rollup["overall"]
    effort = re.search(r"^- Overall effort: (\d+ days?)\s*$", text, re.MULTILINE)
    complete = re.search(r"^- Complete: (\d{1,3})%\s*$", text, re.MULTILINE)
    if not effort:
        problems.append(f"{path}: missing '- Overall effort: {{n}} days' line")
    elif effort.group(1) != days(overall["effort"]):
        problems.append(f"{path}: overall effort {effort.group(1)!r} shall be {days(overall['effort'])!r}")
    if not complete:
        problems.append(f"{path}: missing '- Complete: {{p}}%' line")
    elif int(complete.group(1)) != overall["complete"]:
        problems.append(f"{path}: overall complete {complete.group(1)}% shall be {overall['complete']}%")

    listed = set()
    for number, line in enumerate(lines, 1):
        cells = split_row(line)
        if cells is None or SEPARATOR_ROW.match(line) or cells[0] == "Subsystem":
            continue
        if len(cells) != 3:
            problems.append(f"{path}:{number}: expected 3 cells, found {len(cells)}")
            continue
        link = LINK_CELL.match(cells[0])
        if not link or link.group(2) != f"{link.group(1)}.md":
            problems.append(f"{path}:{number}: subsystem cell shall read '[name](name.md)'")
            continue
        name = link.group(1)
        listed.add(name)
        expected = rollup["subsystems"].get(name)
        if expected is None:
            problems.append(f"{path}:{number}: '{name}' has no {name}.md")
            continue
        if cells[1] != days(expected["effort"]):
            problems.append(f"{path}:{number}: {name} effort {cells[1]!r} shall be {days(expected['effort'])!r}")
        if cells[2] != f"{expected['complete']}%":
            problems.append(f"{path}:{number}: {name} complete {cells[2]!r} shall be '{expected['complete']}%'")
    for name in sorted(set(rollup["subsystems"]) - listed):
        problems.append(f"{path}: subsystem '{name}' is missing from the table")

    roadmap = re.search(r"^## Roadmap\s*$(.*)", text, re.MULTILINE | re.DOTALL)
    if not roadmap:
        problems.append(f"{path}: missing '## Roadmap' section")
    elif not re.search(r"^1\. \S", roadmap.group(1), re.MULTILINE) and overall["complete"] < 100:
        problems.append(f"{path}: roadmap shall be a numbered list while work remains")
    return problems


def cmd_check(args: argparse.Namespace) -> int:
    designs, estimates = Path(args.designs), Path(args.estimates)
    problems: list[str] = []
    if not designs.is_dir():
        print(f"error: {designs} does not exist", file=sys.stderr)
        return 2
    if not estimates.is_dir():
        print(f"error: {estimates} does not exist", file=sys.stderr)
        return 2
    folders = feature_folders(designs)
    rollup, parse_problems = compute_rollup(estimates)
    problems.extend(parse_problems)

    for subsystem, features in folders.items():
        if subsystem not in rollup["subsystems"]:
            problems.append(f"{estimates / (subsystem + '.md')}: missing for design subsystem '{subsystem}'")
            continue
        names = [r["name"] for r in rollup["subsystems"][subsystem]["rows"]]
        for feature in sorted(set(features) - set(names)):
            problems.append(f"{estimates / (subsystem + '.md')}: no row for design '{feature}'")
        for name in sorted(set(names) - set(features)):
            problems.append(f"{estimates / (subsystem + '.md')}: row '{name}' has no design folder")
        duplicates = sorted({n for n in names if names.count(n) > 1})
        for name in duplicates:
            problems.append(f"{estimates / (subsystem + '.md')}: design '{name}' appears more than once")
        if names != sorted(names):
            problems.append(f"{estimates / (subsystem + '.md')}: rows shall be sorted alphabetically")
        for row in rollup["subsystems"][subsystem]["rows"]:
            if row["complete"] % 10:
                problems.append(
                    f"{estimates / (subsystem + '.md')}: {row['name']} complete {row['complete']}% "
                    "shall be rounded to the nearest 10%"
                )
            if row["effort"] == 0:
                problems.append(f"{estimates / (subsystem + '.md')}: {row['name']} effort shall be at least 1 day")
    for subsystem in sorted(set(rollup["subsystems"]) - set(folders)):
        problems.append(f"{estimates / (subsystem + '.md')}: no matching subsystem in {designs}")

    problems.extend(check_root(estimates, rollup))

    for problem in problems:
        print(problem)
    if problems:
        print(f"\n{len(problems)} problem(s) found.", file=sys.stderr)
        return 1
    total = sum(len(f) for f in folders.values())
    print(
        f"OK: {total} design(s) in {len(folders)} subsystem(s); "
        f"{days(rollup['overall']['effort'])}, {rollup['overall']['complete']}% complete."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)

    inventory = sub.add_parser("inventory", help="list designs with the counts estimates start from")
    inventory.add_argument("designs", nargs="?", default="docs/detailed-designs")
    inventory.add_argument("--json", action="store_true")
    inventory.set_defaults(func=cmd_inventory)

    rollup = sub.add_parser("rollup", help="compute subsystem and overall figures")
    rollup.add_argument("estimates", nargs="?", default="docs/estimates")
    rollup.add_argument("--json", action="store_true")
    rollup.set_defaults(func=cmd_rollup)

    check = sub.add_parser("check", help="verify docs/estimates against the designs")
    check.add_argument("designs", nargs="?", default="docs/detailed-designs")
    check.add_argument("estimates", nargs="?", default="docs/estimates")
    check.set_defaults(func=cmd_check)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
