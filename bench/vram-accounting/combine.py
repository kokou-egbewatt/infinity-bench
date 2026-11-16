"""Build data/vram-accounting/desktop.csv from the three runs, for the post's table and widget.

Each run's results.csv mixes totals (everything open, the last reading) with per-app differences.
This turns them into rows that add up: the floor, each app, and what's left unattributed, so that
every row together is the main run's everything-open reading.

    uv run python vram-accounting/combine.py      # from bench/
"""

import csv
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data" / "vram-accounting"
FIELDS = ["consumer_id", "label", "vram_mb", "source", "note"]


def rows(path: Path) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {r["consumer_id"]: r for r in csv.DictReader(f)}


def mib(row: dict) -> int:
    return round(float(row["vram_mib"]))


def combine(main: dict, medal: dict, docker: dict) -> list[dict]:
    apps = [
        ("medal", "Medal", mib(medal["medal"]), "medal/results.csv", "one trial"),
        ("discord", "Discord", mib(main["discord"]), "results.csv", "three trials"),
        (
            "chrome",
            "Chrome, hardware acceleration on",
            mib(main["chrome"]),
            "results.csv",
            "three trials; 193 MiB after running a while, about 100 freshly reopened",
        ),
        (
            "docker_desktop",
            "Docker Desktop",
            mib(docker["docker_desktop"]),
            "docker/results.csv",
            "three trials",
        ),
    ]
    floor = mib(medal["dwm"])
    total = mib(main["desktop"])
    rest = total - floor - sum(a[2] for a in apps)
    out = [
        {
            "consumer_id": "floor",
            "label": "Windows, the display and VS Code",
            "vram_mb": floor,
            "source": "medal/results.csv",
            "note": "every other app closed",
        }
    ]
    out += [dict(zip(FIELDS, a, strict=True)) for a in apps]
    out.append(
        {
            "consumer_id": "unattributed",
            "label": "Not attributed",
            "vram_mb": rest,
            "source": "results.csv",
            "note": f"everything open ({total}) minus the rows above; it varied over the afternoon",
        }
    )
    return out


def main() -> None:
    out = combine(
        rows(DATA / "results.csv"),
        rows(DATA / "medal" / "results.csv"),
        rows(DATA / "docker" / "results.csv"),
    )
    with open(DATA / "desktop.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(out)
    print(f"wrote desktop.csv: {sum(r['vram_mb'] for r in out)} MiB across {len(out)} rows")


if __name__ == "__main__":
    main()
