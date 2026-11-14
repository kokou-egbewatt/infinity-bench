"""Write a harness's results and env.json into data/<post>/.

In the pod that directory is mounted at /out. Run locally, set OUT_DIR to it.
"""

import csv
import json
import os
from pathlib import Path


def out_dir() -> Path:
    return Path(os.environ.get("OUT_DIR", "/out")).resolve()


def _inside(base: Path, name: str) -> Path:
    path = (base / name).resolve()
    if not path.is_relative_to(base):
        raise ValueError(f"{name} would be written outside {base}")
    return path


def _cell(value, digits):
    if isinstance(value, float):
        return f"{value:.{digits}f}"
    return "" if value is None else value


def write_results(
    name: str,
    rows: list[dict],
    fieldnames: list[str],
    precision: dict[str, int] | None = None,
    base: Path | None = None,
) -> Path:
    """Write rows as CSV with LF endings.

    precision maps a column to its decimal places (default 1). A key not in fieldnames is an error.
    """
    base = base or out_dir()
    path = _inside(base, name)
    for row in rows:
        if extra := set(row) - set(fieldnames):
            raise ValueError(f"columns not in fieldnames: {sorted(extra)}")
    path.parent.mkdir(parents=True, exist_ok=True)
    precision = precision or {}
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        for row in rows:
            w.writerow({k: _cell(row.get(k), precision.get(k, 1)) for k in fieldnames})
    return path


def write_env(env: dict, base: Path | None = None) -> Path:
    base = base or out_dir()
    path = _inside(base, "env.json")
    path.write_text(json.dumps(env, indent=2) + "\n", encoding="utf-8", newline="\n")
    return path
